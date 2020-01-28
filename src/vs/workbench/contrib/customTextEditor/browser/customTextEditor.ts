/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Dimension, addDisposableListener } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { EditorOptions, EditorInput } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { CustomTextEditorInput } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditorInput';
import { CustomTextEditorModel } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditorModel';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

export class CustomTextEditor extends BaseEditor {

	static ID = 'customTextEditor';

	private textArea: HTMLTextAreaElement | undefined = undefined;
	private contentListener: IDisposable | undefined = undefined;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService
	) {
		super(CustomTextEditor.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.textArea = document.createElement('textarea');
		this.textArea.style.width = '100%';
		this.textArea.style.height = '100%';

		parent.appendChild(this.textArea);
	}

	layout(dimension: Dimension): void { }

	async setInput(input: EditorInput, options: EditorOptions, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, token);

		if (input instanceof CustomTextEditorInput && this.textArea) {
			const model = await input.resolve();
			if (model instanceof CustomTextEditorModel) {
				this.textArea.textContent = model.content || '';
				this.contentListener = addDisposableListener(this.textArea, 'keyup', () => {
					model.setValue(this.textArea?.value || '');
				});
			}
		}
	}

	clearInput(): void {
		super.clearInput();
		this.contentListener = dispose(this.contentListener);
	}
}

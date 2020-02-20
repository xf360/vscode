/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { Dimension, addDisposableListener } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { EditorOptions, EditorInput, ITextEditorModel } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { DisposableStore } from 'vs/base/common/lifecycle';

export class CustomTextEditor extends BaseEditor {

	static ID = 'customTextEditor';

	private textArea: HTMLTextAreaElement | undefined = undefined;
	private inputDisposables: DisposableStore = this._register(new DisposableStore());

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService
	) {
		super(CustomTextEditor.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.textArea = document.createElement('textarea');
		this.textArea.style.border = '0';
		this.textArea.style.outline = '0';
		this.textArea.style.padding = '5px';
		this.textArea.style.margin = '0';

		parent.appendChild(this.textArea);
	}

	layout(dimension: Dimension): void {
		if (this.textArea) {
			this.textArea.style.width = `${dimension.width - 10}px`;
			this.textArea.style.height = `${dimension.height - 10}px`;
		}
	}

	focus(): void {
		this.textArea?.focus();
	}

	async setInput(input: EditorInput, options: EditorOptions, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, token);

		// Clear any disposables associated with input
		this.inputDisposables.clear();

		// Resolve text model to work with
		const textModel = (await input.resolve() as ITextEditorModel).textEditorModel;
		const textArea = this.textArea;
		if (textModel && textArea) {

			// Set initial editor value from given model
			textArea.value = textModel.getValue() || '';

			// Update model value based on changes in <textarea>
			this.inputDisposables.add(addDisposableListener(textArea, 'keyup', () => {
				const newValue = textArea.value || '';
				if (newValue !== textModel.getValue()) {
					textModel.setValue(newValue);
				}
			}));

			// Update text area based on changes in model
			this.inputDisposables.add(textModel.onDidChangeContent(() => {
				const newValue = textModel.getValue() || '';
				if (newValue !== textArea.value) {
					textArea.value = newValue;
				}
			}));
		}
	}

	clearInput(): void {
		super.clearInput();
		this.inputDisposables.clear();
	}
}

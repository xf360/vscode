/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorModel } from 'vs/workbench/common/editor';
import { URI } from 'vs/base/common/uri';
import { ITextFileService, ITextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import type { IUntitledTextEditorModel } from 'vs/workbench/common/editor/untitledTextEditorModel';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';

export class CustomTextEditorModel extends EditorModel {

	private _content: string | undefined = undefined;
	public get content() { return this._content; }

	private model: ITextFileEditorModel | IUntitledTextEditorModel | undefined = undefined;

	constructor(
		public readonly resource: URI,
		private readonly asUntitled: boolean,
		@ITextFileService private readonly textFileService: ITextFileService
	) {
		super();
	}

	async load(): Promise<CustomTextEditorModel> {
		if (this.asUntitled) {
			let input: UntitledTextEditorInput;
			if (this.textFileService.untitled.exists(this.resource)) {
				input = this.textFileService.untitled.get(this.resource)!;
			} else {
				input = this.textFileService.untitled.create({ untitledResource: this.resource });
			}

			this.model = await input.resolve();
		} else {
			this.model = await this.textFileService.files.resolve(this.resource);
		}

		this._content = this.model.textEditorModel?.getValue();

		return this;
	}

	setValue(value: string): void {
		this.model?.textEditorModel?.setValue(value);
	}
}

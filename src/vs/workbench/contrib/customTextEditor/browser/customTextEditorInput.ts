/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseFileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { BaseUntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/common/editor/untitledTextEditorModel';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';

export class CustomTextFileEditorInput extends BaseFileEditorInput {

	getName(): string {
		return `[custom text editor] ${super.getName()}`;
	}

	getTypeId(): string {
		return 'customTextFileEditorInput';
	}

	getPreferredEditorId(candidates: string[]): string {
		return 'customTextEditor';
	}

	matches(otherInput: unknown): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput) {
			return otherInput instanceof CustomTextFileEditorInput && otherInput.resource.toString() === this.resource.toString();
		}

		return false;
	}
}

export class CustomUntitledTextEditorInput extends BaseUntitledTextEditorInput {

	getTypeId(): string {
		return 'customUntitledTextEditorInput';
	}

	getName(): string {
		return `[custom text editor] ${super.getName()}`;
	}

	getPreferredEditorId(candidates: string[]): string {
		return 'customTextEditor';
	}

	async resolve(): Promise<UntitledTextEditorModel & IResolvedTextEditorModel> {
		const model = await super.resolve();

		this.textFileService.untitled.add(this);

		return model;
	}

	matches(otherInput: unknown): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput) {
			return otherInput instanceof CustomUntitledTextEditorInput && otherInput.resource.toString() === this.resource.toString();
		}

		return false;
	}
}

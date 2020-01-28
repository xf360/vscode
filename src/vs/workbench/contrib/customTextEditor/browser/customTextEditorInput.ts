/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextEditorInput } from 'vs/workbench/common/editor';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { URI } from 'vs/base/common/uri';
import { CustomTextEditorModel } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditorModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { ITextFileService, ModelState } from 'vs/workbench/services/textfile/common/textfiles';
import { IFileService, FileSystemProviderCapabilities } from 'vs/platform/files/common/files';
import { IFilesConfigurationService, AutoSaveMode } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';

export class CustomTextEditorInput extends TextEditorInput {

	constructor(
		public readonly resource: URI,
		private readonly asUntitled: boolean,
		@IFileService private readonly fileService: IFileService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorService protected readonly editorService: IEditorService,
		@IEditorGroupsService protected readonly editorGroupService: IEditorGroupsService,
		@ITextFileService protected readonly textFileService: ITextFileService,
		@IFilesConfigurationService private readonly filesConfigurationService: IFilesConfigurationService
	) {
		super(resource, editorService, editorGroupService, textFileService);

		this.registerListeners();
	}

	private registerListeners(): void {

		// Dirty changes
		if (this.isUntitled()) {
			this._register(this.textFileService.untitled.onDidChangeDirty(m => this.onDirtyStateChange(m)));
		} else {
			this._register(this.textFileService.files.onDidChangeDirty(m => this.onDirtyStateChange(m.resource)));
			this._register(this.textFileService.files.onDidSave(e => this.onDirtyStateChange(e.model.resource)));
			this._register(this.textFileService.files.onDidRevert(m => this.onDirtyStateChange(m.resource)));
		}
	}

	private onDirtyStateChange(uri: URI): void {
		if (uri.toString() === this.resource.toString()) {
			this._onDidChangeDirty.fire();
		}
	}

	getTypeId(): string {
		return 'customTextEditorInput';
	}

	async resolve(): Promise<IEditorModel | null> {
		const model = this.instantiationService.createInstance(CustomTextEditorModel, this.resource, this.asUntitled);

		return model.load();
	}

	isUntitled(): boolean {
		return this.asUntitled;
	}

	isReadonly(): boolean {
		if (this.isUntitled()) {
			return false;
		}

		const model = this.textFileService.files.get(this.resource);

		return model?.isReadonly() || this.fileService.hasCapability(this.resource, FileSystemProviderCapabilities.Readonly);
	}

	isDirty(): boolean {
		if (this.isUntitled()) {
			return !!this.textFileService.untitled.get(this.resource)?.isDirty();
		}

		const model = this.textFileService.files.get(this.resource);
		if (!model) {
			return false;
		}

		return model.isDirty();
	}

	isSaving(): boolean {
		if (this.isUntitled()) {
			return false;
		}

		const model = this.textFileService.files.get(this.resource);
		if (!model) {
			return false;
		}

		if (model.hasState(ModelState.SAVED) || model.hasState(ModelState.CONFLICT) || model.hasState(ModelState.ERROR)) {
			return false; // require the model to be dirty and not in conflict or error state
		}

		// Note: currently not checking for ModelState.PENDING_SAVE for a reason
		// because we currently miss an event for this state change on editors
		// and it could result in bad UX where an editor can be closed even though
		// it shows up as dirty and has not finished saving yet.

		if (this.filesConfigurationService.getAutoSaveMode() === AutoSaveMode.AFTER_SHORT_DELAY) {
			return true; // a short auto save is configured, treat this as being saved
		}

		return false;
	}

	matches(otherInput: unknown): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput) {
			return otherInput instanceof CustomTextEditorInput && otherInput.resource.toString() === this.resource.toString() && otherInput.isUntitled() === this.isUntitled();
		}

		return false;
	}
}

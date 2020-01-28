/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { EditorInput, IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorInputExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IEditorRegistry, EditorDescriptor, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { CustomTextEditor } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditor';
import { CustomTextEditorInput } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditorInput';
// eslint-disable-next-line code-translation-remind
import { localize } from 'vs/nls';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';

// Register file editors
Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
	EditorDescriptor.create(
		CustomTextEditor,
		CustomTextEditor.ID,
		localize('binaryFileEditor', "Custom Text Editor")
	),
	[
		new SyncDescriptor<EditorInput>(CustomTextEditorInput)
	]
);

export class OpenCustomTextEditorAction extends Action {

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super('openCustomTextEditor', 'Open Custom Text Editor', undefined, true);
	}

	run(): any {
		return this.editorService.openEditor(this.instantiationService.createInstance(CustomTextEditorInput, URI.parse(__filename), false));
	}
}

export class OpenUntitledCustomTextEditorAction extends Action {

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super('openCustomTextEditor', 'Open Untitled Custom Text Editor', undefined, true);
	}

	run(): any {
		return this.editorService.openEditor(this.instantiationService.createInstance(CustomTextEditorInput, URI.parse('untitled://custom-text-editor'), true));
	}
}

const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	SyncActionDescriptor.create(OpenCustomTextEditorAction, 'openCustomTextEditor', 'Open Custom Text Editor'),
	'Open Custom Text Editor'
);

registry.registerWorkbenchAction(
	SyncActionDescriptor.create(OpenUntitledCustomTextEditorAction, 'openUntitledCustomTextEditor', 'Open Untitled Custom Text Editor'),
	'Open Untitled Custom Text Editor'
);

class CustomTextEditorInputFactory implements IEditorInputFactory {

	canSerialize() { return true; }

	serialize(editorInput: EditorInput): string | undefined {
		if (editorInput instanceof CustomTextEditorInput) {
			return JSON.stringify({ resource: editorInput.getResource().toString(), untitled: editorInput.isUntitled() });
		}

		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): CustomTextEditorInput {
		const deserialized = JSON.parse(serializedEditorInput);
		const resource = URI.parse(deserialized.resource);

		return instantiationService.createInstance(CustomTextEditorInput, resource, deserialized.untitled);
	}
}

Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories).registerEditorInputFactory('customTextEditorInput', CustomTextEditorInputFactory);

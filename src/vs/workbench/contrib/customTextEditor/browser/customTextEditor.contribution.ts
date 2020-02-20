/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { EditorInput, IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorInputExtensions } from 'vs/workbench/common/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { IEditorRegistry, EditorDescriptor, Extensions as EditorExtensions } from 'vs/workbench/browser/editor';
import { CustomTextEditor } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditor';
import { CustomTextFileEditorInput, CustomUntitledTextEditorInput } from 'vs/workbench/contrib/customTextEditor/browser/customTextEditorInput';
// eslint-disable-next-line code-translation-remind
import { localize } from 'vs/nls';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { Event } from 'vs/base/common/event';
import { dirname, join } from 'vs/base/common/path';

// Register file editors
Registry.as<IEditorRegistry>(EditorExtensions.Editors).registerEditor(
	EditorDescriptor.create(
		CustomTextEditor,
		CustomTextEditor.ID,
		localize('binaryFileEditor', "Custom Text Editor")
	),
	[
		new SyncDescriptor<EditorInput>(CustomTextFileEditorInput),
		new SyncDescriptor<EditorInput>(CustomUntitledTextEditorInput)
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
		return this.editorService.openEditor(this.instantiationService.createInstance(CustomTextFileEditorInput, URI.parse(join(dirname(dirname(dirname(dirname(dirname(dirname(dirname(__filename))))))), 'README.md')), undefined, undefined));
	}
}

export class OpenUntitledCustomTextEditorAction extends Action {

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super('openCustomTextEditor', 'Open Untitled Custom Text Editor', undefined, true);
	}

	run(): any {
		const model = this.textFileService.untitled.create();

		const input = this.instantiationService.createInstance(CustomUntitledTextEditorInput, model);
		Event.once(input.onDispose)(() => model.dispose());

		return this.editorService.openEditor(this.instantiationService.createInstance(CustomUntitledTextEditorInput, model));
	}
}

export class OpenUntitledCustomTextEditorWithInitialTextAction extends Action {

	constructor(
		id: string,
		label: string,
		@IEditorService private readonly editorService: IEditorService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super('openCustomTextEditor', 'Open Untitled Custom Text Editor With Initial Text', undefined, true);
	}

	async run(): Promise<any> {
		const model = await this.textFileService.untitled.create().load();
		model.setValue('Initial Contents', true);

		const input = this.instantiationService.createInstance(CustomUntitledTextEditorInput, model);
		Event.once(input.onDispose)(() => model.dispose());

		return this.editorService.openEditor(input);
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

registry.registerWorkbenchAction(
	SyncActionDescriptor.create(OpenUntitledCustomTextEditorWithInitialTextAction, 'openUntitledCustomTextEditorWithInitialText', 'Open Untitled Custom Text Editor With Initial Text'),
	'Open Untitled Custom Text Editor With Initial Text'
);

class CustomTextEditorInputFactory implements IEditorInputFactory {

	canSerialize() { return true; }

	serialize(editorInput: EditorInput): string | undefined {
		if (editorInput instanceof CustomTextFileEditorInput || editorInput instanceof CustomUntitledTextEditorInput) {
			return JSON.stringify({
				typeId: editorInput.getTypeId(),
				resource: editorInput.resource.toString()
			});
		}

		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): CustomTextFileEditorInput | CustomUntitledTextEditorInput {
		const deserialized = JSON.parse(serializedEditorInput);
		const resource = URI.parse(deserialized.resource);
		const typeId = deserialized.typeId;

		if (typeId === 'customTextFileEditorInput') {
			return instantiationService.createInstance(CustomTextFileEditorInput, resource, undefined, undefined);
		}

		return instantiationService.invokeFunction(accessor => {
			return instantiationService.createInstance(CustomUntitledTextEditorInput, accessor.get(ITextFileService).untitled.create({ untitledResource: resource }));
		});
	}
}

Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories).registerEditorInputFactory('customTextFileEditorInput', CustomTextEditorInputFactory);
Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories).registerEditorInputFactory('customUntitledTextEditorInput', CustomTextEditorInputFactory);

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import * as network from 'vs/base/common/network';
import { basename } from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import 'vs/css!./media/searchEditor';
import { Range } from 'vs/editor/common/core/range';
import { ITextModel, TrackedRangeStickiness } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { localize } from 'vs/nls';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { GroupIdentifier, IEditorInput } from 'vs/workbench/common/editor';
import { SearchEditorFindMatchClass } from 'vs/workbench/contrib/searchEditor/browser/constants';
import { extractSearchQuery, serializeSearchConfiguration } from 'vs/workbench/contrib/searchEditor/browser/searchEditorSerialization';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { ITextFileSaveOptions, ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { BaseFileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { BaseUntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { ITextModelService, IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { ILabelService } from 'vs/platform/label/common/label';
import { IFileService } from 'vs/platform/files/common/files';
import { IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';


export type SearchConfiguration = {
	query: string,
	includes: string,
	excludes: string
	contextLines: number,
	wholeWord: boolean,
	caseSensitive: boolean,
	regexp: boolean,
	useIgnores: boolean,
	showIncludesExcludes: boolean,
};

const SEARCH_EDITOR_EXT = '.code-search';

export class UntitledSearchEditorInput extends BaseUntitledTextEditorInput {

	static ID = 'workbench.editorinputs.untitledSearchEditorInput';

	private readonly contentsModel: Promise<ITextModel>;
	private readonly headerModel: Promise<ITextModel>;
	private _cachedContentsModel: ITextModel | undefined;
	private _cachedConfig?: SearchConfiguration;

	private readonly _onDidChangeContent = new Emitter<void>();
	readonly onDidChangeContent: Event<void> = this._onDidChangeContent.event;

	private oldDecorationsIDs: string[] = [];

	constructor(
		model: IUntitledTextEditorModel,
		getModel: (input: UntitledSearchEditorInput) => Promise<{ contentsModel: ITextModel, headerModel: ITextModel }>,
		@ITextFileService textFileService: ITextFileService,
		@ILabelService labelService: ILabelService,
		@IFileService fileService: IFileService,
		@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(model, textFileService, labelService, editorService, editorGroupService, fileService, filesConfigurationService);

		const modelLoader = getModel(this)
			.then(({ contentsModel, headerModel }) => {
				this._register(contentsModel.onDidChangeContent(() => this._onDidChangeContent.fire()));
				this._register(headerModel.onDidChangeContent(() => {
					this._cachedConfig = extractSearchQuery(headerModel);
					this._onDidChangeContent.fire();
					this._onDidChangeLabel.fire();
				}));

				this._cachedConfig = extractSearchQuery(headerModel);
				this._cachedContentsModel = contentsModel;

				this._register(contentsModel);
				this._register(headerModel);
				this._onDidChangeLabel.fire();

				return { contentsModel, headerModel };
			});

		this.contentsModel = modelLoader.then(({ contentsModel }) => contentsModel);
		this.headerModel = modelLoader.then(({ headerModel }) => headerModel);
	}

	async getModels() {
		const header = await this.headerModel;
		const body = await this.contentsModel;
		return { header, body };
	}

	getConfigSync() {
		return this._cachedConfig;
	}

	getName(maxLength = 12): string {
		const trimToMax = (label: string) => (label.length < maxLength ? label : `${label.slice(0, maxLength - 3)}...`);

		if (this.isUntitled()) {
			const query = this._cachedConfig?.query?.trim();
			if (query) {
				return localize('searchTitle.withQuery', "Search: {0}", trimToMax(query));
			}
			return localize('searchTitle', "Search");
		}

		return localize('searchTitle.withQuery', "Search: {0}", basename(this.resource.path, SEARCH_EDITOR_EXT));
	}

	getMatchRanges(): Range[] {
		return (this._cachedContentsModel?.getAllDecorations() ?? [])
			.filter(decoration => decoration.options.className === SearchEditorFindMatchClass)
			.map(({ range }) => range);
	}

	async setMatchRanges(ranges: Range[]) {
		this.oldDecorationsIDs = (await this.contentsModel).deltaDecorations(this.oldDecorationsIDs, ranges.map(range =>
			({ range, options: { className: SearchEditorFindMatchClass, stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } })));
	}

	getTypeId(): string {
		return UntitledSearchEditorInput.ID;
	}

	async save(group: GroupIdentifier, options?: ITextFileSaveOptions): Promise<IEditorInput | undefined> {
		const res = await super.save(group, options);
		if (!res || !res.resource) {
			return res;
		}

		return this.instantiationService.invokeFunction(getOrMakeSearchEditorInput, { uri: res.resource });
	}

	async saveAs(group: GroupIdentifier, options?: ITextFileSaveOptions): Promise<IEditorInput | undefined> {
		const res = await super.saveAs(group, options);
		if (!res || !res.resource) {
			return res;
		}

		return this.instantiationService.invokeFunction(getOrMakeSearchEditorInput, { uri: res.resource });
	}

	matches(otherInput: unknown): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput) {
			return otherInput instanceof UntitledSearchEditorInput && otherInput.resource.toString() === this.resource.toString();
		}

		return false;
	}
}

export class FileSearchEditorInput extends BaseFileEditorInput {

	static ID = 'workbench.editorinputs.fileSearchEditorInput';

	private readonly contentsModel: Promise<ITextModel>;
	private readonly headerModel: Promise<ITextModel>;
	private _cachedContentsModel: ITextModel | undefined;
	private _cachedConfig?: SearchConfiguration;

	private oldDecorationsIDs: string[] = [];

	constructor(
		resource: URI,
		getModel: (input: FileSearchEditorInput) => Promise<{ contentsModel: ITextModel, headerModel: ITextModel }>,
		@IInstantiationService instantiationService: IInstantiationService,
		@ITextFileService textFileService: ITextFileService,
		@ITextModelService textModelResolverService: ITextModelService,
		@ILabelService labelService: ILabelService,
		@IFileService fileService: IFileService,
		@IFilesConfigurationService filesConfigurationService: IFilesConfigurationService,
		@IEditorService editorService: IEditorService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService
	) {
		super(resource, undefined, undefined, instantiationService, textFileService, textModelResolverService, labelService, fileService, filesConfigurationService, editorService, editorGroupService);

		const modelLoader = getModel(this)
			.then(({ contentsModel, headerModel }) => {
				this._register(headerModel.onDidChangeContent(() => {
					this._cachedConfig = extractSearchQuery(headerModel);
					this._onDidChangeLabel.fire();
				}));

				this._cachedConfig = extractSearchQuery(headerModel);
				this._cachedContentsModel = contentsModel;

				this._register(contentsModel);
				this._register(headerModel);
				this._onDidChangeLabel.fire();

				return { contentsModel, headerModel };
			});

		this.contentsModel = modelLoader.then(({ contentsModel }) => contentsModel);
		this.headerModel = modelLoader.then(({ headerModel }) => headerModel);
	}

	getName(maxLength = 12): string {
		const trimToMax = (label: string) => (label.length < maxLength ? label : `${label.slice(0, maxLength - 3)}...`);

		if (this.isUntitled()) {
			const query = this._cachedConfig?.query?.trim();
			if (query) {
				return localize('searchTitle.withQuery', "Search: {0}", trimToMax(query));
			}
			return localize('searchTitle', "Search");
		}

		return localize('searchTitle.withQuery', "Search: {0}", basename(this.resource.path, SEARCH_EDITOR_EXT));
	}

	getConfigSync() {
		return this._cachedConfig;
	}

	async getModels() {
		const header = await this.headerModel;
		const body = await this.contentsModel;
		return { header, body };
	}

	getMatchRanges(): Range[] {
		return (this._cachedContentsModel?.getAllDecorations() ?? [])
			.filter(decoration => decoration.options.className === SearchEditorFindMatchClass)
			.map(({ range }) => range);
	}

	async setMatchRanges(ranges: Range[]) {
		this.oldDecorationsIDs = (await this.contentsModel).deltaDecorations(this.oldDecorationsIDs, ranges.map(range =>
			({ range, options: { className: SearchEditorFindMatchClass, stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } })));
	}

	getTypeId(): string {
		return FileSearchEditorInput.ID;
	}

	matches(otherInput: unknown): boolean {
		if (super.matches(otherInput) === true) {
			return true;
		}

		if (otherInput) {
			return otherInput instanceof FileSearchEditorInput && otherInput.resource.toString() === this.resource.toString();
		}

		return false;
	}
}

const inputs = new Map<string, UntitledSearchEditorInput | FileSearchEditorInput>();
export const getOrMakeSearchEditorInput = (
	accessor: ServicesAccessor,
	existingData:
		{ uri: URI, config?: Partial<SearchConfiguration>, text?: never } |
		{ text: string, uri?: never, config?: never } |
		{ config: Partial<SearchConfiguration>, text?: never, uri?: never }
): UntitledSearchEditorInput | FileSearchEditorInput => {

	const instantiationService = accessor.get(IInstantiationService);
	const modelService = accessor.get(IModelService);
	const textFileService = accessor.get(ITextFileService);
	const modeService = accessor.get(IModeService);

	const existing = existingData.uri ? inputs.get(existingData.uri.toString()) : undefined;
	if (existing) {
		return existing;
	}

	const getModel = async (input: UntitledSearchEditorInput | FileSearchEditorInput) => {
		const textFileModel = (await input.resolve() as IResolvedTextEditorModel);

		if (input instanceof UntitledSearchEditorInput) {
			let initialValue: string | undefined = undefined;
			if (existingData.text) {
				initialValue = existingData.text;
			} else if (existingData.config) {
				initialValue = serializeSearchConfiguration(existingData.config);
			}

			if (initialValue) {
				(textFileModel as IResolvedTextEditorModel & IUntitledTextEditorModel).setValue(initialValue, true);
			}
		}

		const lines = textFileModel.textEditorModel.getValue().split(/\r?\n/);

		const headerlines = [];
		const bodylines = [];
		let inHeader = true;
		for (const line of lines) {
			if (inHeader) {
				headerlines.push(line);
				if (line === '') {
					inHeader = false;
				}
			} else {
				bodylines.push(line);
			}
		}

		const contentsModelURI = input.resource.with({ scheme: 'search-editor-body' });
		const headerModelURI = input.resource.with({ scheme: 'search-editor-header' });
		const contentsModel = modelService.getModel(contentsModelURI) ?? modelService.createModel('', modeService.create('search-result'), contentsModelURI);
		const headerModel = modelService.getModel(headerModelURI) ?? modelService.createModel('', modeService.create('search-result'), headerModelURI);

		contentsModel.setValue(bodylines.join('\n'));
		headerModel.setValue(headerlines.join('\n'));

		return { contentsModel, headerModel };
	};

	let input: UntitledSearchEditorInput | FileSearchEditorInput;
	if (!existingData.uri || existingData.uri.scheme === network.Schemas.untitled) {
		const model = textFileService.untitled.create({ untitledResource: existingData.uri, mode: 'search-result' });
		input = instantiationService.createInstance(UntitledSearchEditorInput, model, getModel);
	} else {
		input = instantiationService.createInstance(FileSearchEditorInput, existingData.uri, getModel);
	}

	inputs.set(input.resource.toString(), input);
	input.onDispose(() => inputs.delete(input.resource.toString()));

	return input;
};

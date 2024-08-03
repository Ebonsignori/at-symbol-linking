import { Notice, type TFile, type App } from "obsidian";
import { fileOption } from "src/types";
import { replaceNewFileVars } from "src/utils/replace-new-file-vars";
import { fileNameNoExtension } from "src/utils/path";
import { type AtSymbolLinkingSettings } from "src/settings/settings";

export async function sharedSelectSuggestion(
	app: App,
	settings: AtSymbolLinkingSettings,
	value: Fuzzysort.KeysResult<fileOption>
): Promise<string> {
	// When user selects "Create new note" option, create the note to link to
	let linkFile;
	if (value?.obj?.isCreateNewOption) {
		let newNoteContents = "";
		if (settings.addNewNoteTemplateFile) {
			const fileTemplate = app.vault.getAbstractFileByPath(
				`${settings.addNewNoteTemplateFile}.md`
			) as TFile;
			newNoteContents = (await app.vault.read(fileTemplate)) || "";
			// Use core template settings to replace variables: {{title}}, {{date}}, {{time}}
			newNoteContents = await replaceNewFileVars(
				app,
				newNoteContents,
				fileNameNoExtension(value.obj?.filePath)
			);
		}

		let filePath: string|null=null;
		try {
			if (settings.keepTriggerSymbol)
				filePath = value.obj?.filePath.replace(/([^/]+)$/, `${settings.triggerSymbol}$1`);
			else
				filePath = value.obj?.filePath;
			linkFile = await app.vault.create(filePath, newNoteContents);
			// Update the alias to the name for displaying the @ link
			value.obj.alias = value.obj?.query;
		} catch (error) {
			new Notice(
				`Unable to create new note at path: ${filePath}. Please open an issue on GitHub, https://github.com/Ebonsignori/obsidian-at-symbol-linking/issues`,
				0
			);
			throw error;
		}
	}

	const currentFile = app.workspace.getActiveFile();
	if (!linkFile) {
		linkFile = app.vault.getAbstractFileByPath(
			value.obj?.filePath
		) as TFile;
	}
	let alias = settings.keepTriggerSymbol ? "" : (value.obj?.alias || "");
	if (settings.includeSymbol && !settings.keepTriggerSymbol) alias = `${settings.triggerSymbol}${alias || value.obj?.fileName}`;
	let linkText = app.fileManager.generateMarkdownLink(
		linkFile,
		currentFile?.path || "",
		undefined, // we don't care about the subpath
		alias
	);

	if (linkText.includes("\n")) {
		linkText = linkText.replace(/\n/g, "");
	}

	return linkText;
}

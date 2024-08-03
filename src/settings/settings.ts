import {
	App,
	ButtonComponent,
	Notice,
	PluginSettingTab,
	Setting,
} from "obsidian";
import AtSymbolLinking from "src/main";
import { FolderSuggest } from "./folder-suggest";
import { FileSuggest } from "./file-suggest";

export interface AtSymbolLinkingSettings {
	triggerSymbol: string;
	includeSymbol: boolean;
	limitLinkDirectories: Array<string>;

	showAddNewNote: boolean;
	addNewNoteTemplateFile: string;
	addNewNoteDirectory: string;

	useCompatibilityMode: boolean;
	leavePopupOpenForXSpaces: number;

	invalidCharacterRegex: string;
	invalidCharacterRegexFlags: string;

	removeAccents: boolean;
	keepTriggerSymbol: boolean;
}

export const DEFAULT_SETTINGS: AtSymbolLinkingSettings = {
	triggerSymbol: "@",
	limitLinkDirectories: [],
	includeSymbol: true,

	showAddNewNote: false,
	addNewNoteTemplateFile: "",
	addNewNoteDirectory: "",

	useCompatibilityMode: false,
	leavePopupOpenForXSpaces: 0,

	// eslint-disable-next-line no-useless-escape
	invalidCharacterRegex: `[\[\]^|#]`,
	invalidCharacterRegexFlags: "i",

	removeAccents: true,
	keepTriggerSymbol: false,
};

const arrayMove = <T>(array: T[], fromIndex: number, toIndex: number): void => {
	if (toIndex < 0 || toIndex === array.length) {
		return;
	}
	const temp = array[fromIndex];
	array[fromIndex] = array[toIndex];
	array[toIndex] = temp;
};

export class SettingsTab extends PluginSettingTab {
	plugin: AtSymbolLinking;
	shouldReset: boolean;

	constructor(app: App, plugin: AtSymbolLinking) {
		super(app, plugin);
		this.plugin = plugin;
		this.shouldReset = false;
	}

	// On close, reload the plugin
	hide() {
		this.plugin.reloadPlugin(this.shouldReset);
		this.shouldReset = false;
	}

	display(): void {
		this.containerEl.empty();

		// Begin triggerSymbol option: Determine which symbol triggers the popup
		const triggerSymbolDesc = document.createDocumentFragment();
		triggerSymbolDesc.append("Type this symbol to trigger the popup.");
		new Setting(this.containerEl)
			.setName("Trigger Symbol")
			.setDesc(triggerSymbolDesc)
			.addText((text) => {
				text.setPlaceholder("@")
					.setValue(this.plugin.settings.triggerSymbol)
					.onChange((value: string) => {
						this.plugin.settings.triggerSymbol = value;
						this.plugin.saveSettings();
					});
				text.inputEl.onblur = () => {
					this.display();
					this.validate();
				};
			});

		// Begin includeSymbol option: Determine whether to include @ symbol in link
		const includeSymbolDesc = document.createDocumentFragment();
		includeSymbolDesc.append(
			`Include the ${this.plugin.settings.triggerSymbol} symbol prefixing the final link text`,
			includeSymbolDesc.createEl("br"),
			includeSymbolDesc.createEl("em", {
				text: `E.g. [${
					this.plugin.settings.includeSymbol
						? this.plugin.settings.triggerSymbol
						: ""
				}evan](./evan)`,
			})
		);
		new Setting(this.containerEl)
			.setName(`Include ${this.plugin.settings.triggerSymbol} symbol`)
			.setDesc(includeSymbolDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeSymbol)
					.onChange((value: boolean) => {
						this.plugin.settings.includeSymbol = value;
						this.plugin.saveSettings();
						this.display();
					})
			);
		// End includeSymbol option

		// Begin limitLinksToFolders option: limit which folders links are sourced from
		const ruleDesc = document.createDocumentFragment();
		ruleDesc.append(
			`${this.plugin.settings.triggerSymbol} linking will only source links from the following folders.`,
			ruleDesc.createEl("br"),
			`For example, you might only want contacts in the Contacts/ folder to be linked when you type ${this.plugin.settings.triggerSymbol}.`,
			ruleDesc.createEl("br"),
			ruleDesc.createEl("em", {
				text: "If no folders are added, links will be sourced from all folders.",
			})
		);

		new Setting(this.containerEl)
			.setName("Limit links to folders")
			.setDesc(ruleDesc)
			.addButton((button: ButtonComponent) => {
				button
					.setTooltip("Add limit folder")
					.setButtonText("+")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.limitLinkDirectories.push("");
						await this.plugin.saveSettings();
						return this.display();
					});
			});

		this.plugin.settings.limitLinkDirectories.forEach(
			(directory, index) => {
				const newDirectorySetting = new Setting(this.containerEl)
					.setClass("at-symbol-linking-folder-container")
					.addSearch((cb) => {
						new FolderSuggest(this.app, cb.inputEl);
						cb.setPlaceholder("Folder")
							.setValue(directory)
							.onChange(async (newFolder) => {
								this.plugin.settings.limitLinkDirectories[
									index
								] = newFolder.trim();
								await this.plugin.saveSettings();
							});
						cb.inputEl.onblur = () => {
							this.validate();
						};
					})
					.addExtraButton((cb) => {
						cb.setIcon("up-chevron-glyph")
							.setTooltip("Move up")
							.onClick(async () => {
								arrayMove(
									this.plugin.settings.limitLinkDirectories,
									index,
									index - 1
								);
								await this.plugin.saveSettings();
								this.display();
							});
					})
					.addExtraButton((cb) => {
						cb.setIcon("down-chevron-glyph")
							.setTooltip("Move down")
							.onClick(async () => {
								arrayMove(
									this.plugin.settings.limitLinkDirectories,
									index,
									index + 1
								);
								await this.plugin.saveSettings();
								this.display();
							});
					})
					.addExtraButton((cb) => {
						cb.setIcon("cross")
							.setTooltip("Delete")
							.onClick(async () => {
								this.plugin.settings.limitLinkDirectories.splice(
									index,
									1
								);
								await this.plugin.saveSettings();
								this.display();
							});
					});
				newDirectorySetting.controlEl.addClass(
					"at-symbol-linking-folder-setting"
				);
				newDirectorySetting.infoEl.remove();
			}
		);
		// End limitLinksToFolders option

		new Setting(this.containerEl).setName("Add new note").setHeading();

		// Begin add new note option
		new Setting(this.containerEl)
			.setName("Add new note if it doesn't exist")
			.setDesc(
				`If the note doesn't exist when ${this.plugin.settings.triggerSymbol} linking, add an option to create the note.`
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showAddNewNote)
					.onChange((value: boolean) => {
						this.plugin.settings.showAddNewNote = value;
						this.plugin.saveSettings();
						this.display();
					})
			);
		// End add new note option

		if (this.plugin.settings.showAddNewNote) {
			// Begin add new note template folder
			const newNoteTemplateDesc = document.createDocumentFragment();
			newNoteTemplateDesc.append(
				`Template to use when creating a new note from ${this.plugin.settings.triggerSymbol} link.`,
				newNoteTemplateDesc.createEl("br"),
				"Uses formats from the ",
				newNoteTemplateDesc.createEl("a", {
					text: "core templates plugin",
					href: "https://help.obsidian.md/Plugins/Templates",
				}),
				" to replace the following variables in the template:",
				newNoteTemplateDesc.createEl("br"),
				newNoteTemplateDesc.createEl("code", {
					text: "{{title}}",
				}),
				" - The title of the new file",
				newNoteTemplateDesc.createEl("br"),
				newNoteTemplateDesc.createEl("code", {
					text: "{{date}}",
				}),
				" - The current date",
				newNoteTemplateDesc.createEl("br"),
				newNoteTemplateDesc.createEl("code", {
					text: "{{time}}",
				}),
				" - The current time"
			);
			new Setting(this.containerEl)
				.setName("Add new note template")
				.setDesc(newNoteTemplateDesc)
				.addSearch((cb) => {
					new FileSuggest(this.app, cb.inputEl);
					cb.setPlaceholder("No template (blank note)")
						.setValue(this.plugin.settings.addNewNoteTemplateFile)
						.onChange(async (newFile) => {
							this.plugin.settings.addNewNoteTemplateFile =
								newFile.trim();
							await this.plugin.saveSettings();
						});
					cb.inputEl.onblur = () => {
						this.validate();
					};
				});
			// End add new note template folder

			// Begin add new note directory
			new Setting(this.containerEl)
				.setName("Add new note folder")
				.setDesc(
					`Folder to create new notes in when using ${this.plugin.settings.triggerSymbol} linking.`
				)
				.addSearch((cb) => {
					new FolderSuggest(this.app, cb.inputEl);
					cb.setPlaceholder("No folder (root)")
						.setValue(this.plugin.settings.addNewNoteDirectory)
						.onChange(async (newFolder) => {
							this.plugin.settings.addNewNoteDirectory =
								newFolder.trim();
							await this.plugin.saveSettings();
						});
					cb.inputEl.onblur = () => {
						this.validate();
					};
				});
			// End add new note directory
		}

		new Setting(this.containerEl)
			.setName("Suggestion popup behavior")
			.setHeading();

		// Begin useCompatibilityMode option
		const useCompatibilityModeDesc = document.createDocumentFragment();
		useCompatibilityModeDesc.append(
			useCompatibilityModeDesc.createEl("br"),
			"Renders an HTML popup in place of the native Obsidian popup.",
			useCompatibilityModeDesc.createEl("br"),
			"Useful if you other plugins are interfering with the popup (e.g. the Tasks plugin).",
			useCompatibilityModeDesc.createEl("br"),
			useCompatibilityModeDesc.createEl("em", {
				text: "May be slower than the native popup.",
			})
		);
		new Setting(this.containerEl)
			.setName("Use compatibility mode")
			.setDesc(useCompatibilityModeDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useCompatibilityMode)
					.onChange((value: boolean) => {
						this.shouldReset = true;
						this.plugin.settings.useCompatibilityMode = value;
						this.plugin.saveSettings();
						this.plugin.registerPopup();
						this.display();
					})
			);
		// End useCompatibilityMode option

		// Begin leavePopupOpenForXSpaces option
		const leavePopupOpenDesc = document.createDocumentFragment();
		leavePopupOpenDesc.append(
			`When ${this.plugin.settings.triggerSymbol} linking, you might want to type a full name e.g. "Brandon Sanderson" without the popup closing.`,
			leavePopupOpenDesc.createEl("br"),
			leavePopupOpenDesc.createEl("em", {
				text: "When set above 0, you'll need to press escape, return/enter, or type over X spaces to close the popup.",
			})
		);
		new Setting(this.containerEl)
			.setName("Leave popup open for X spaces")
			.setDesc(leavePopupOpenDesc)
			.addText((text) => {
				text.setPlaceholder("0")
					.setValue(
						this.plugin.settings.leavePopupOpenForXSpaces?.toString()
					)
					.onChange(async (value) => {
						this.plugin.settings.leavePopupOpenForXSpaces =
							parseInt(value, 10);
						await this.plugin.saveSettings();
					});
				text.inputEl.onblur = () => {
					this.validate();
				};
			});
		// End leavePopupOpenForXSpaces option

		new Setting(this.containerEl).setName("Advanced settings").setHeading();

		// Begin invalid character regex option
		const invalidCharacterRegexDesc = document.createDocumentFragment();
		invalidCharacterRegexDesc.append(
			invalidCharacterRegexDesc.createEl("br"),
			"Characters typed that match this regex will not be included in the final search query in compatibility mode.",
			invalidCharacterRegexDesc.createEl("br"),
			"In normal mode, the popup will close when an invalid character is typed."
		);

		new Setting(this.containerEl)
			.setName("Invalid character Regex")
			.setDesc(invalidCharacterRegexDesc)
			.addText((text) => {
				text.setPlaceholder(this.plugin.settings.invalidCharacterRegex)
					.setValue(this.plugin.settings.invalidCharacterRegex)
					.onChange(async (value) => {
						this.plugin.settings.invalidCharacterRegex = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.onblur = () => {
					this.validate("invalidCharacterRegex");
				};
			});
		// End valid character regex option

		// Begin valid character regex flags option
		const invalidCharacterRegexFlagsDesc =
			document.createDocumentFragment();
		invalidCharacterRegexFlagsDesc.append(
			"Flags to use with the invalid character regex."
		);

		new Setting(this.containerEl)
			.setName("Invalid character Regex flags")
			.setDesc(invalidCharacterRegexFlagsDesc)
			.addText((text) => {
				text.setPlaceholder(
					this.plugin.settings.invalidCharacterRegexFlags
				)
					.setValue(this.plugin.settings.invalidCharacterRegexFlags)
					.onChange(async (value) => {
						this.plugin.settings.invalidCharacterRegexFlags = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.onblur = () => {
					this.validate("invalidCharacterRegexFlags");
				};
			});
		// End valid character regex flags option

		// Begin remove accents option
		new Setting(this.containerEl)
			.setName("Remove accents from search query")
			.setDesc(
				"e.g. é -> e when searching or creating links via the popup."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.removeAccents)
					.onChange((value: boolean) => {
						this.plugin.settings.removeAccents = value;
						this.plugin.saveSettings();
					})
			);
		
		// Retain @ in file name
		new Setting(this.containerEl)
			.setName("Retain the trigger symbol for file name")
			.setDesc("Retain a literal <trigger symbol> at the start of the file names")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.keepTriggerSymbol)
					.onChange((value: boolean) => {
						this.plugin.settings.keepTriggerSymbol = value;
						this.plugin.saveSettings();
					})
			);
	}

	async validate(editedSetting?: string) {
		const settings = this.plugin.settings;
		const updateSetting = async (
			setting: keyof AtSymbolLinkingSettings,
			value: any
		) => {
			// @ts-expect-error update setting with any
			this.plugin.settings[setting] = value;
			await this.plugin.saveSettings();
			return this.display();
		};

		// triggerSymbol should be a single character
		if (settings.triggerSymbol.length !== 1) {
			new Notice(`Trigger symbol must be a single character.`);
			await updateSetting(
				"triggerSymbol",
				settings.triggerSymbol.length ? settings.triggerSymbol[0] : "@"
			);
		}

		// Folders should exist
		for (let i = 0; i < settings.limitLinkDirectories.length; i++) {
			const folder = settings.limitLinkDirectories[i];
			if (folder === "") {
				continue;
			}
			const folderFile = this.app.vault.getAbstractFileByPath(folder);
			if (!folderFile) {
				new Notice(
					`Unable to find folder at path: ${folder}. Please add it if you want to limit links to this folder.`
				);
				const newFolders = [...settings.limitLinkDirectories];
				newFolders[i] = "";
				await updateSetting("limitLinkDirectories", newFolders);
			}
		}

		// Template file should exist when add new note option is enabled
		if (settings.showAddNewNote && settings.addNewNoteTemplateFile) {
			const templateFile = this.app.vault.getAbstractFileByPath(
				`${settings.addNewNoteTemplateFile}.md`
			);
			if (!templateFile) {
				new Notice(
					`Unable to find template file at path: ${settings.addNewNoteTemplateFile}.md`
				);
				await updateSetting("addNewNoteTemplateFile", "");
			}
		}

		// Destination directory should exist when add new note option is enabled
		if (settings.showAddNewNote && settings.addNewNoteDirectory) {
			const templateFile = this.app.vault.getAbstractFileByPath(
				`${settings.addNewNoteDirectory}`
			);
			if (!templateFile) {
				new Notice(
					`Unable to find folder for new notes at path: ${settings.addNewNoteDirectory}. Please add it if you want to create new notes in this folder.`
				);
				await updateSetting("addNewNoteDirectory", "");
			}
		}

		// Leave popup open for X spaces should be a number
		if (
			isNaN(parseInt(settings.leavePopupOpenForXSpaces.toString())) ||
			settings.leavePopupOpenForXSpaces < 0
		) {
			await updateSetting("leavePopupOpenForXSpaces", 0);
		}

		// Regex should be valid and not be empty
		if (settings.invalidCharacterRegex?.trim() === "") {
			await updateSetting(
				"invalidCharacterRegex",
				DEFAULT_SETTINGS.invalidCharacterRegex
			);
		}
		try {
			new RegExp(
				settings.invalidCharacterRegex,
				settings.invalidCharacterRegexFlags
			);
		} catch (e) {
			new Notice(`Invalid regex or flags`);
			if (editedSetting === "invalidCharacterRegex") {
				await updateSetting(
					"invalidCharacterRegex",
					DEFAULT_SETTINGS.invalidCharacterRegex
				);
			} else if (editedSetting === "invalidCharacterRegexFlags") {
				await updateSetting(
					"invalidCharacterRegexFlags",
					DEFAULT_SETTINGS.invalidCharacterRegexFlags
				);
			}
		}
	}
}

import * as vscode from 'vscode';
import { GoInterfaceCodeLensProvider } from './interfaceCodeLens';

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("gohelp");

    context.subscriptions.push(
        // Register Selection and Find All Reference Command
        vscode.commands.registerCommand('gohelp.findImplementationsBySelection', (startPosition: vscode.Position, endPosition: vscode.Position) => {
            outputChannel.appendLine("Running: gohelp.findImplementationsBySelection");
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const newSelection = new vscode.Selection(startPosition, endPosition);
                editor.selection = newSelection;
            }
            // After setting the selection, call the built-in command
            vscode.commands.executeCommand('references-view.findImplementations');
        }),
        vscode.commands.registerCommand('gohelp.findReferencesBySelection', (startPosition: vscode.Position, endPosition: vscode.Position) => {
            outputChannel.appendLine("Running: gohelp.findReferencesBySelection");
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const newSelection = new vscode.Selection(startPosition, endPosition);
                editor.selection = newSelection;
            }
            // After setting the selection, call the built-in command
            vscode.commands.executeCommand('references-view.findReferences');
        }),
        // Register Implementation CodeLens provider.
        vscode.languages.registerCodeLensProvider(
            { language: 'go', scheme: 'file' },
            new GoInterfaceCodeLensProvider(outputChannel)
        )
    );
}



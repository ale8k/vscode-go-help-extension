import * as vscode from 'vscode';
interface PositionRange {
    startPos: vscode.Position;
    endPos: vscode.Position;
    range: vscode.Range;
}

/**
 * GoImplementationProvider provides a CodeLens above interfaces to find
 * implementations and references. Additionally, in the CodeLens itself, it display the count
 * of implementations and references.
 */
export class GoInterfaceCodeLensProvider implements vscode.CodeLensProvider {
    private output: vscode.OutputChannel;

    constructor(output: vscode.OutputChannel) {
        this.output = output;
    }

    private getConfiguration() {
        const config = vscode.workspace.getConfiguration('gohelp');
        return {
            showInterfaceImplNames: config.get('codeLens.interfaces.implementations.names', true),
            showInterfaceImplMethods: config.get('codeLens.interfaces.implementation.methods', true),
            showInterfaceRefNames: config.get('codeLens.interfaces.references.names', true),
            showInterfaceRefMethods: config.get('codeLens.interfaces.references.methods', true)
        };
    }

    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        this.output.appendLine(`Running CodeLens for: ${document.fileName}`);

        const codeLenses: vscode.CodeLens[] = [];
        const { 
            showInterfaceImplNames, 
            showInterfaceImplMethods,
            showInterfaceRefNames,
            showInterfaceRefMethods, 
        } = this.getConfiguration();

        const text = document.getText();
        const interfaceRegex = /type\s+(\w+)\s+interface\s*{([^}]*)}/g;


        let interfaceMatch: RegExpExecArray | null;
        while ((interfaceMatch = interfaceRegex.exec(text))) {
            if (showInterfaceImplNames) {
                await this.setInterfaceNameCodeLens(
                    document, 
                    interfaceMatch, 
                    codeLenses, 
                    'implementations'
                );
            }

            if (showInterfaceRefNames) {
                await this.setInterfaceNameCodeLens(
                    document, 
                    interfaceMatch, 
                    codeLenses, 
                    'references'
                );
            }

            if (showInterfaceImplMethods) {
                await this.setInterfaceMethodCodeLens(
                    document, 
                    interfaceMatch, 
                    codeLenses, 
                    'implementations'
                );
            }

            if (showInterfaceRefMethods) {
                await this.setInterfaceMethodCodeLens(
                    document, 
                    interfaceMatch, 
                    codeLenses, 
                    'references'
                );
            }
        }

        return codeLenses;
    }

    private async setInterfaceNameCodeLens(
        document: vscode.TextDocument,
        match: RegExpExecArray,
        codeLenses: vscode.CodeLens[],
        actionType: 'references' | 'implementations'
    ) {
        const positionRange = await this.getInterfaceNamePositions(document, match);
        const count = await this.countInterfaceImplOrRef(document, positionRange.endPos, actionType);

        switch (actionType) {
            case 'references':
                codeLenses.push(new vscode.CodeLens(positionRange.range, {
                    title: `${count} Ref${count !== 1 ? 's' : ''}`,
                    command: 'gohelp.findReferencesBySelection',
                    arguments: [positionRange.startPos, positionRange.endPos]
                }));
                break;
            case 'implementations':
                codeLenses.push(new vscode.CodeLens(positionRange.range, {
                    title: `${count} Impl${count !== 1 ? 's' : ''}`,
                    command: 'gohelp.findImplementationsBySelection',
                    arguments: [positionRange.startPos, positionRange.endPos]
                }));
                break;
            default:
                this.output.appendLine("setInterfaceNameCodeLens error: cannot determine action type: "+ actionType);
                return;
        }
    }

    private async setInterfaceMethodCodeLens(
        document: vscode.TextDocument,
        interfaceMatch: RegExpExecArray,
        codeLenses: vscode.CodeLens[],
        actionType: 'references' | 'implementations'
    ) {
        // Iterate over the interface body
        const interfaceBody = interfaceMatch[2];

        // Match the methods
        let methodMatch: RegExpExecArray | null;
        const methodRegex = /(\w+)\s*\(/g;

        // Iterate body finding methods
        while ((methodMatch = methodRegex.exec(interfaceBody))) {
            let methodStart =
                interfaceMatch.index +
                interfaceMatch[0].indexOf("{") +
                methodMatch.index;
            let methodEnd = methodStart + methodMatch[0].length;

            let methodStartPos = document.positionAt(methodStart);
            let methodEndPos = document.positionAt(methodEnd);
            let range = new vscode.Range(methodStartPos, methodEndPos);

            const count = await this.countInterfaceImplOrRef(document, methodEndPos, actionType);

            switch (actionType) {
                case 'references':
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: `${count} Ref${count !== 1 ? 's' : ''}`,
                        command: 'gohelp.findReferencesBySelection',
                        arguments: [methodStartPos, methodEndPos]
                    }));
                    break;
                case 'implementations':
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: `${count} Impl${count !== 1 ? 's' : ''}`,
                        command: 'gohelp.findImplementationsBySelection',
                        arguments: [methodStartPos, methodEndPos]
                    }));
                    break;
                default:
                    this.output.appendLine("setInterfaceMethodCodeLens error: cannot determine action type: "+ actionType);
                    return;
            }

        }
    }

    private async countInterfaceImplOrRef(
        document: vscode.TextDocument,
        position: vscode.Position,
        actionType: 'references' | 'implementations'
    ): Promise<number> {
        let locations: vscode.Location[];
        switch (actionType) {
            case 'references':
                locations = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeReferenceProvider',
                    document.uri,
                    position
                );
                break;
            case 'implementations':
                locations = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeImplementationProvider',
                    document.uri,
                    position
                );
                break;
        }

        const count = locations ? locations.length : 0;
        return count;
    }

    private async getInterfaceNamePositions(document: vscode.TextDocument, match: RegExpExecArray): Promise<PositionRange> {
        // Match the name and the body of the interface
        const interfaceName = match[1];
        // Start pos begins at the interface name itself. I.e,
        // type MyInterface interface = M
        const startPos = document.positionAt(match.index + 5);
        // End Pos ends at the end of the interface name. I.e.,
        // type MyInterface interface = e
        const endPos = document.positionAt(match.index + 5 + interfaceName.length);
        // Ranged together, we get MyInterface
        const range = new vscode.Range(startPos, endPos);

        return {
            startPos: startPos,
            endPos: endPos,
            range: range
        };
    }
}

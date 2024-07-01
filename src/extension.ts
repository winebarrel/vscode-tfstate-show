import * as vscode from "vscode";
import { dirname } from "path";
import * as util from "util";
import * as childPprocess from "child_process"; // eslint-disable-line
const exec = util.promisify(childPprocess.exec);

const output = vscode.window.createOutputChannel("tfstate-show");

function findResource(activeTextEditor: vscode.TextEditor): string | null {
  const lineNum = activeTextEditor.selection.active.line;
  const document = activeTextEditor.document;

  for (let i = lineNum + 1; i--; i > 0) {
    const line = document.lineAt(i).text.trimEnd();

    let m: RegExpMatchArray | null;

    if ((m = line.match(/^(resource|data)\s+"([^"]+)"\s+"([^"]+)"\s+{/))) {
      const blkName = m[1];
      const resType = m[2];
      const resName = m[3];

      let res = `${resType}.${resName}`;

      if (blkName === "data") {
        res = `${blkName}.${res}`;
      }

      return res;
    } else if ((m = line.match(/^module\s+"([^"]+)"\s+{/))) {
      const modName = m[1];
      return `module.${modName}`;
    }
  }

  return null;
}

async function terraformStateList(res: string, cwd: string): Promise<string[]> {
  const out = (
    await exec(`terraform state list '${res}'`, {
      cwd: cwd,
      env: { ...process.env, TF_CLI_ARGS: "-no-color" },
    })
  ).stdout;

  const list = [];

  for (const i of out.trim().split(/\n/)) {
    const r = i.trim();

    if (r) {
      list.push(r);
    }
  }

  return list;
}

async function terraformInit(cwd: string): Promise<string> {
  const out = (
    await exec(`terraform init`, {
      cwd: cwd,
      env: { ...process.env, TF_CLI_ARGS: "-no-color" },
    })
  ).stdout;

  return out;
}

async function tfInit() {
  const activeTextEditor = vscode.window.activeTextEditor;

  if (!activeTextEditor) {
    return;
  }

  const cwd = dirname(activeTextEditor.document.fileName);
  const init = await terraformInit(cwd);

  output.clear();
  output.show(true);
  output.append(init);
}

async function terraformStateShow(res: string, cwd: string): Promise<string> {
  const out = (
    await exec(`terraform state show '${res}'`, {
      cwd: cwd,
      env: { ...process.env, TF_CLI_ARGS: "-no-color" },
    })
  ).stdout;

  return out;
}

async function tfStateShow() {
  const activeTextEditor = vscode.window.activeTextEditor;

  if (!activeTextEditor) {
    return;
  }

  const res = findResource(activeTextEditor);

  if (!res) {
    vscode.window.showWarningMessage("Terraform resource not found");
    return;
  }

  const cwd = dirname(activeTextEditor.document.fileName);
  const list = await terraformStateList(res, cwd);

  if (list.length === 0) {
    vscode.window.showWarningMessage("Terraform resource not found");
    return;
  }

  output.clear();
  output.show(true);

  const states = await Promise.all(list.map((r) => terraformStateShow(r, cwd)));

  for (const s of states) {
    output.append(s);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const initDisposable = vscode.commands.registerCommand(
    "tfstate-show.tfInit",
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: "Loading tfstate",
        },
        async (progress) => {
          progress.report({ increment: 0 });

          try {
            await tfInit();
          } catch (e) {
            vscode.window.showErrorMessage(`${e}`);
          }

          progress.report({ increment: 100 });
        }
      );
    }
  );

  context.subscriptions.push(initDisposable);

  const stateShowDisposable = vscode.commands.registerCommand(
    "tfstate-show.tfStateShow",
    async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: "Loading tfstate",
        },
        async (progress) => {
          progress.report({ increment: 0 });

          try {
            await tfStateShow();
          } catch (e) {
            vscode.window.showErrorMessage(`${e}`);
          }

          progress.report({ increment: 100 });
        }
      );
    }
  );

  context.subscriptions.push(stateShowDisposable);
}

export function deactivate() {}

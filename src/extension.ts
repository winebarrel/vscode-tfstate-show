import * as vscode from 'vscode';
import { dirname } from 'path';
import * as util from "util";
import * as childPprocess from "child_process"; // eslint-disable-line
const exec = util.promisify(childPprocess.exec);

const output = vscode.window.createOutputChannel("tfstate-show");

function findResource(activeTextEditor: vscode.TextEditor): string | null {
  const lineNum = activeTextEditor.selection.active.line;
  const document = activeTextEditor.document;

  for (let i = lineNum; i--; i >= 0) {
    const line = document.lineAt(i).text;
    const m = line.match(/^\s*(resource|data)\s+"([^"]+)"\s+"([^"]+)"\s*{/);

    if (!m) {
      continue;
    }

    const blkName = m[1];
    const resType = m[2];
    const resName = m[3];

    let res = `${resType}.${resName}`;

    if (blkName === "data") {
      res = `data.${res}`;
    }

    return res;
  }

  return null;
}

async function terraformStateList(res: string, cwd: string): Promise<string[]> {
  const out = (await exec(`terraform state list '${res}'`, {
    cwd: cwd,
    env: { ...process.env, TF_CLI_ARGS: '-no-color' },
  })).stdout;

  const list = [];

  for (const i of out.trim().split(/\n/)) {
    const r = i.trim();

    if (r) {
      list.push(r);
    }
  }

  return list;
}

async function terraformStateShow(res: string, cwd: string): Promise<string> {
  const out = (await exec(`terraform state show '${res}'`, {
    cwd: cwd,
    env: { ...process.env, TF_CLI_ARGS: '-no-color' },
  })).stdout;

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

  try {
    const list = await terraformStateList(res, cwd);

    if (list.length === 0) {
      vscode.window.showWarningMessage("Terraform resource not found");
      return;
    }

    output.clear();
    output.show(true);

    for (const r of list) {
      const state = await terraformStateShow(r, cwd);
      output.append(state);
    }
  } catch (e) {
    vscode.window.showErrorMessage(`${e}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('tfstate-show.tfStateShow', tfStateShow);
  context.subscriptions.push(disposable);
}

export function deactivate() { }

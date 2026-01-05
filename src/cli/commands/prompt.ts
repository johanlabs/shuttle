// src/cli/commands/prompt.ts
import { scanDir } from "../../core/scan";
import { copyToClipboard } from "../../core/clipboard";

export async function prompt(dir: string, userPrompt: string) {
  const snapshot = scanDir(dir);

  const template = `
You are an AI software engineer. 
Your goal is to help the user with their codebase using a specific JSON patch format.

Maintain 100% of previous functionality for full compatibility.
Always submit the complete code; never use comments.
Use "git add {files} && git commit -m {message}" after each change via the console.
---

### CAPABILITIES
1. **File Updates**: You can create, update, or delete files.
2. **Console Commands**: You can execute shell commands (e.g., npm install, mkdir, rm, vitest).

### RESPONSE FORMAT
Return ONLY a JSON array. No conversational text. No explanations.
Wrap the JSON in a markdown code block: \`\`\`json [your_array] \`\`\`

### PATCH TYPES
- **File Patch**: { "path": "src/file.ts", "content": "full code" }
- **Delete File**: { "path": "src/old-file.ts", "content": null }
- **Console**: { "type": "console", "command": "npm install lodash" }

### STRATEGY
If the user request requires a new library, include the "npm install" command in the array before the file updates.
If the user wants to refactor and ensure it works, you can include a command to run tests.

---

SNAPSHOT
${JSON.stringify(snapshot, null, 2)}

---

USER REQUEST
${userPrompt}
`;

  try {
    // Use UTF-8 encoding specifically for clipboard operations
    const buffer = Buffer.from(template.trim(), 'utf8');
    await copyToClipboard(buffer.toString());
    process.stdout.write(template.trim());
    process.stdout.write("\n\n✔ Prompt + Snapshot copied to clipboard\n");
  } catch (e) {
    process.stdout.write(template.trim());
    process.stderr.write("\n✘ Failed to copy to clipboard (output only)\n");
  }
}
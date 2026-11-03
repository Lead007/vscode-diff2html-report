import { diffArrays, diffWordsWithSpace } from "diff";
import { DiffBlock, DiffFile, DiffLine, LineType } from "diff2html/lib/types";

interface DiffTextPart {
    type: 'context' | 'insert' | 'delete';
    text: string;
}

interface DiffRow {
    lineNo?: number;
    text: string;
    parts?: DiffTextPart[];
}

interface DiffRowPair {
    oldRow: DiffRow | null;
    newRow: DiffRow | null;
}

export enum DiffBlockType {
    INSERT = 'insert',
    DELETE = 'delete',
    CHANGE = 'change',
    CONTEXT = 'context',
}
export interface DiffBlockParsed {
    type: DiffBlockType;
    rows: DiffRowPair[];
}

function formatLineContent(line: string): string {
    // 去掉前面的 + 或 - 符号，替换为空格
    return line.replace(/^[+-]/, ' ');
}

export function alignDiffLines(blocks: DiffBlock[]): DiffBlockParsed[] {
    const result: DiffBlockParsed[] = [];


    for (const block of blocks) {
        const lines = block.lines;
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // 1. 连续的上下文行（未修改）
            if (line.type === LineType.CONTEXT) {
                const rows: DiffRowPair[] = [];

                while (i < lines.length && lines[i].type === LineType.CONTEXT) {
                    const ln = lines[i];
                    const row = { text: formatLineContent(ln.content) };
                    rows.push({
                        oldRow: { ...row, lineNo: ln.oldNumber ?? undefined },
                        newRow: { ...row, lineNo: ln.newNumber ?? undefined },
                    });
                    i++;
                }

                result.push({ type: DiffBlockType.CONTEXT, rows });
                continue;
            }

            // 2. 收集连续的 deleted 和 added 行，形成一个“修改段”
            const deletedLines: DiffLine[] = [];
            const addedLines: DiffLine[] = [];

            // 收集删除行
            while (i < lines.length && lines[i].type === LineType.DELETE) {
                deletedLines.push(lines[i]);
                i++;
            }
            // 收集新增行
            while (i < lines.length && lines[i].type === LineType.INSERT) {
                addedLines.push(lines[i]);
                i++;
            }

            // 3. 使用 diffArrays 进行 LCS 逐行配对
            if (deletedLines.length > 0 && addedLines.length > 0) {
                const oldTexts = deletedLines.map(l => formatLineContent(l.content));
                const newTexts = addedLines.map(l => formatLineContent(l.content));

                // diffArrays 返回最小编辑脚本
                const diffResult = diffArrays(oldTexts, newTexts);

                const rows: DiffRowPair[] = [];

                let delPtr = 0; // 指针：追踪 deletedLines 消耗到哪了
                let addPtr = 0; // 指针：追踪 addedLines 消耗到哪了

                for (let partIndex = 0; partIndex < diffResult.length;) {
                    const part = diffResult[partIndex];

                    if (!part.added && !part.removed) {
                        for (const text of part.value) {
                            const oldLine = deletedLines[delPtr++];
                            const newLine = addedLines[addPtr++];
                            rows.push({
                                oldRow: { lineNo: oldLine.oldNumber ?? undefined, text },
                                newRow: { lineNo: newLine.newNumber ?? undefined, text },
                            });
                        }
                        partIndex++;
                        continue;
                    }

                    const removedLines: DiffLine[] = [];
                    const insertedLines: DiffLine[] = [];

                    while (partIndex < diffResult.length &&
                        (diffResult[partIndex].added || diffResult[partIndex].removed)) {
                        const change = diffResult[partIndex];
                        if (change.removed) {
                            for (const _ of change.value) {
                                removedLines.push(deletedLines[delPtr++]);
                            }
                        } else if (change.added) {
                            for (const _ of change.value) {
                                insertedLines.push(addedLines[addPtr++]);
                            }
                        }
                        partIndex++;
                    }

                    const pairedCount = Math.min(removedLines.length, insertedLines.length);
                    for (let index = 0; index < pairedCount; index++) {
                        const oldLine = removedLines[index];
                        const newLine = insertedLines[index];
                        const oldText = formatLineContent(oldLine.content);
                        const newText = formatLineContent(newLine.content);
                        const characterDiff = diffWordsWithSpace(oldText, newText);
                        const oldParts: DiffTextPart[] = [];
                        const newParts: DiffTextPart[] = [];

                        for (const characterPart of characterDiff) {
                            if (!characterPart.added) {
                                oldParts.push({
                                    type: characterPart.removed ? 'delete' : 'context',
                                    text: characterPart.value,
                                });
                            }
                            if (!characterPart.removed) {
                                newParts.push({
                                    type: characterPart.added ? 'insert' : 'context',
                                    text: characterPart.value,
                                });
                            }
                        }

                        rows.push({
                            oldRow: {
                                lineNo: oldLine.oldNumber ?? undefined,
                                text: oldText,
                                parts: oldParts,
                            },
                            newRow: {
                                lineNo: newLine.newNumber ?? undefined,
                                text: newText,
                                parts: newParts,
                            },
                        });
                    }

                    for (const oldLine of removedLines.slice(pairedCount)) {
                        rows.push({
                            oldRow: {
                                lineNo: oldLine.oldNumber ?? undefined,
                                text: formatLineContent(oldLine.content),
                            },
                            newRow: null,
                        });
                    }
                    for (const newLine of insertedLines.slice(pairedCount)) {
                        rows.push({
                            oldRow: null,
                            newRow: {
                                lineNo: newLine.newNumber ?? undefined,
                                text: formatLineContent(newLine.content),
                            },
                        });
                    }
                }

                result.push({ type: DiffBlockType.CHANGE, rows });

            } else if (deletedLines.length > 0) {
                // 纯删除块（没有对应新增）
                result.push({
                    type: DiffBlockType.DELETE,
                    rows: deletedLines.map(l => ({
                        oldRow: { lineNo: l.oldNumber ?? undefined, text: formatLineContent(l.content) },
                        newRow: null,
                    })),
                });

            } else if (addedLines.length > 0) {
                // 纯新增块（没有对应删除）
                result.push({
                    type: DiffBlockType.INSERT,
                    rows: addedLines.map(l => ({
                        oldRow: null,
                        newRow: { lineNo: l.newNumber ?? undefined, text: formatLineContent(l.content) },
                    })),
                });
            }
        }
    }

    return result;
}

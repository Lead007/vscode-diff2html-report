<script setup lang="ts">
import { DiffBlockParsed, DiffBlockType } from '../../../src/diffUtils';

const props = defineProps<{ item: DiffBlockParsed[] }>();

</script>
<template>
    <div class="d2h-wrapper">
        <table class="d2h-diff-table">
            <tbody class="d2h-diff-tbody">
                <template v-for="(block, blockIndex) in props.item" :key="blockIndex">
                    <!--上下文-->
                    <template v-if="block.type === DiffBlockType.CONTEXT">
                        <tr v-for="(row, lineIndex) in block.rows" :key="`${blockIndex}:${lineIndex}`">
                            <td class="d2h-code-linenumber d2h-cntx">
                                <div class="line-num1">{{ row.oldRow?.lineNo ?? '' }}</div>
                                <div class="line-num2">{{ row.newRow?.lineNo ?? '' }}</div>
                            </td>
                            <td class="d2h-cntx">
                                <div class="d2h-code-line">
                                    <span class="d2h-code-line-prefix">&nbsp;</span>
                                    <span class="d2h-code-line-ctn" v-if="row.oldRow?.text">{{ row.oldRow.text }}</span>
                                    <span class="d2h-code-line-ctn" v-else><br /></span>
                                </div>
                            </td>
                        </tr>
                    </template>
                    <!--纯添加-->
                    <template v-else-if="block.type === DiffBlockType.INSERT">
                        <tr v-for="(row, lineIndex) in block.rows" :key="`${blockIndex}:${lineIndex}`">
                            <td class="d2h-code-linenumber d2h-ins">
                                <div class="line-num1"></div>
                                <div class="line-num2">{{ row.newRow?.lineNo ?? '' }}</div>
                            </td>
                            <td class="d2h-ins">
                                <div class="d2h-code-line">
                                    <span class="d2h-code-line-prefix">+</span>
                                    <span class="d2h-code-line-ctn" v-if="row.newRow?.text">{{ row.newRow.text
                                        }}</span>
                                    <span class="d2h-code-line-ctn" v-else><br /></span>
                                </div>
                            </td>
                        </tr>
                    </template>
                    <!--纯删除-->
                    <template v-else-if="block.type === DiffBlockType.DELETE">
                        <tr v-for="(row, lineIndex) in block.rows" :key="`${blockIndex}:${lineIndex}`">
                            <td class="d2h-code-linenumber d2h-del">
                                <div class="line-num1">{{ row.oldRow?.lineNo ?? '' }}</div>
                                <div class="line-num2"></div>
                            </td>
                            <td class="d2h-del">
                                <div class="d2h-code-line">
                                    <span class="d2h-code-line-prefix">-</span>
                                    <span class="d2h-code-line-ctn" v-if="row.oldRow?.text">{{ row.oldRow.text
                                        }}</span>
                                    <span class="d2h-code-line-ctn" v-else><br /></span>
                                </div>
                            </td>
                        </tr>
                    </template>
                    <!--修改-->
                    <template v-else>
                        <template v-for="(row, lineIndex) in block.rows" :key="`${blockIndex}:${lineIndex}`">
                            <tr v-if="row.oldRow" :key="`${blockIndex}:${lineIndex}:old`">
                                <td class="d2h-code-linenumber d2h-del d2h-change">
                                    <div class="line-num1">{{ row.oldRow.lineNo ?? '' }}</div>
                                    <div class="line-num2"></div>
                                </td>
                                <td class="d2h-del d2h-change">
                                    <div class="d2h-code-line">
                                        <span class="d2h-code-line-prefix">-</span>
                                        <span class="d2h-code-line-ctn">
                                            <template v-if="row.oldRow.parts">
                                                <template v-for="(part, partIndex) in row.oldRow.parts"
                                                    :key="partIndex">
                                                    <del v-if="part.type === 'delete'">{{ part.text }}</del>
                                                    <span v-else>{{ part.text }}</span>
                                                </template>
                                            </template>
                                            <template v-else>{{ row.oldRow.text }}</template>
                                        </span>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="row.newRow" :key="`${blockIndex}:${lineIndex}:new`">
                                <td class="d2h-code-linenumber d2h-ins d2h-change">
                                    <div class="line-num1"></div>
                                    <div class="line-num2">{{ row.newRow.lineNo ?? '' }}</div>
                                </td>
                                <td class="d2h-ins d2h-change">
                                    <div class="d2h-code-line">
                                        <span class="d2h-code-line-prefix">+</span>
                                        <span class="d2h-code-line-ctn">
                                            <template v-if="row.newRow.parts">
                                                <template v-for="(part, partIndex) in row.newRow.parts"
                                                    :key="partIndex">
                                                    <ins v-if="part.type === 'insert'">{{ part.text }}</ins>
                                                    <span v-else>{{ part.text }}</span>
                                                </template>
                                            </template>
                                            <template v-else>{{ row.newRow.text }}</template>
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </template>

                    </template>
                </template>
            </tbody>
        </table>
    </div>

</template>
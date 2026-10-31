import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const build = mkdtempSync(join(tmpdir(), 'sgnl-history-'));
after(() => rmSync(build, {recursive:true,force:true}));
const source = readFileSync(new URL('../src/engine/editorHistory.ts', import.meta.url),'utf8');
writeFileSync(join(build,'history.cjs'), ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const {createEditorHistory,editorHistoryReducer:r}=createRequire(import.meta.url)(join(build,'history.cjs'));
const doc=n=>({value:n,regions:[]});
test('one continuous gesture keeps previous edits and undoes in one step',()=>{
 let s=createEditorHistory(doc(0));s=r(s,{type:'update',document:doc(1),record:true});s=r(s,{type:'begin'});
 for(let n=2;n<80;n++)s=r(s,{type:'update',document:doc(n),record:true});
 assert.equal(s.snapshots.length,2);s=r(s,{type:'commit'});assert.equal(s.snapshots.length,3);
 s=r(s,{type:'undo'});assert.equal(s.document.value,1);s=r(s,{type:'undo'});assert.equal(s.document.value,0);
});
test('cancel restores the pre-gesture value and a new edit replaces redo branch',()=>{
 let s=createEditorHistory(doc(0));s=r(s,{type:'begin'});s=r(s,{type:'update',document:doc(10),record:true});s=r(s,{type:'cancel'});
 assert.equal(s.document.value,0);assert.equal(s.snapshots.length,1);
 for(const n of [1,2])s=r(s,{type:'update',document:doc(n),record:true});
 s=r(s,{type:'undo'});s=r(s,{type:'update',document:doc(3),record:true});s=r(s,{type:'redo'});
 assert.equal(s.document.value,3);assert.deepEqual(s.snapshots.map(d=>d.value),[0,1,3]);
});
test('canvas previews and identical commits do not consume history',()=>{
 let s=createEditorHistory(doc(0));
 for(let n=1;n<=100;n++)s=r(s,{type:'update',document:doc(n),record:false});
 assert.equal(s.snapshots.length,1);s=r(s,{type:'update',document:doc(100),record:true});s=r(s,{type:'update',document:doc(100),record:true});
 assert.equal(s.snapshots.length,2);s=r(s,{type:'undo'});assert.equal(s.document.value,0);
});

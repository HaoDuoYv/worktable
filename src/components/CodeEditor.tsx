import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets } from '@codemirror/autocomplete'

export type EditorLang = 'javascript' | 'python' | 'cpp'

export interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  /** 1-based line to highlight (signature command cursor) */
  activeLine?: number | null
  className?: string
  language?: EditorLang
}

function languageExtension(lang: EditorLang): Extension {
  if (lang === 'python') return python()
  if (lang === 'cpp') return cpp()
  return javascript()
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  activeLine = null,
  className = '',
  language = 'javascript',
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        autocompletion(),
        highlightSelectionMatches(),
        languageExtension(language),
        syntaxHighlighting(
          HighlightStyle.define([
            { tag: tags.keyword, color: 'var(--accent)' },
            { tag: tags.controlKeyword, color: 'var(--accent)' },
            { tag: tags.definitionKeyword, color: 'var(--accent)' },
            { tag: tags.operatorKeyword, color: 'var(--accent)' },
            { tag: tags.moduleKeyword, color: 'var(--accent)' },
            { tag: tags.string, color: 'var(--signal)' },
            { tag: tags.special(tags.string), color: 'var(--signal)' },
            { tag: tags.number, color: 'var(--warn)' },
            { tag: tags.float, color: 'var(--warn)' },
            { tag: tags.bool, color: 'var(--warn)' },
            { tag: tags.function(tags.variableName), color: 'var(--text)' },
            { tag: tags.comment, color: 'var(--text-subtle)', fontStyle: 'italic' },
            { tag: tags.variableName, color: 'var(--text)' },
            { tag: tags.className, color: 'var(--text)' },
            { tag: tags.typeName, color: 'var(--text)' },
            { tag: tags.propertyName, color: 'var(--text)' },
            { tag: tags.operator, color: 'var(--text-muted)' },
            { tag: tags.punctuation, color: 'var(--text-muted)' },
            { tag: tags.tagName, color: 'var(--accent)' },
            { tag: tags.attributeName, color: 'var(--signal)' },
          ]),
          { fallback: true },
        ),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '13px',
            backgroundColor: 'var(--canvas)',
            color: 'var(--text)',
          },
          '.cm-content': {
            fontFamily: 'var(--font-mono)',
            caretColor: 'var(--accent)',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--panel)',
            color: 'var(--text-subtle)',
            border: 'none',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--accent-soft)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--accent-soft)',
          },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: hostRef.current,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // recreate only on mount / readOnly / language flip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, language])

  // external value sync
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  // active line highlight (signature)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    // clear previous via recompute decoration using selection of the line
    if (activeLine == null) return
    const line = view.state.doc.line(Math.max(1, Math.min(activeLine, view.state.doc.lines)))
    view.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      selection: { anchor: line.from },
    })
  }, [activeLine])

  return <div ref={hostRef} className={`code-editor ${className}`.trim()} />
}

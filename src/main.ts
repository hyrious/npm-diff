declare const __DEV__: boolean

if (__DEV__) {
  new EventSource('/esbuild').addEventListener('change', (e) => {
    const { added, removed, updated } = JSON.parse(e.data)

    if (added.length === 0 && removed.length === 0 && updated.length === 1) {
      for (const link of document.getElementsByTagName('link')) {
        const url = new URL(link.href)
        if (url.host === location.host && url.pathname === updated[0]) {
          const next = link.cloneNode() as HTMLLinkElement
          next.href = updated[0] + '?t=' + Date.now()
          next.onload = () => link.remove()
          link.parentNode!.insertBefore(next, link.nextSibling)
          return
        }
      }
    }

    location.reload()
  })
}

import './styles.css'
import { valid, diff, DiffOptions } from '../../src/index'
import { get, set, keys, createStore } from 'idb-keyval'

declare const Diff2HtmlUI: any

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T

const show = (el: HTMLElement) => {
  el.style.display = ''
}
const hide = (el: HTMLElement) => {
  el.style.display = 'none'
}
const toggle = (el: HTMLElement, force?: boolean) => {
  if (force !== undefined) {
    el.style.display = force ? '' : 'none'
    return force
  } else {
    const next = el.style.display ? '' : 'none'
    el.style.display = next
    return next === ''
  }
}

const NPM_PACKAGES = createStore('npm', 'packages')

Object.assign(window, { idb: { keys, get, set, NPM_PACKAGES } })

const idb_key = (pkg: { name: string; version: string }) => pkg.name + '@' + pkg.version

const cache_options: DiffOptions = {
  cache_get: (pkg) => get(idb_key(pkg), NPM_PACKAGES),
  cache_set: (pkg, data) => set(idb_key(pkg), data, NPM_PACKAGES),
}

let is_first_run = true
let hash = ''
let diffUnified = 3
let diffIgnoreAllSpace = false
let diffNameOnly = false
let highlight = true
let outputFormat = 'line-by-line'
let registry = ''

const $title = $('#title')
const $spec_a = $<HTMLInputElement>('#a')
const $spec_b = $<HTMLInputElement>('#b')
const $run = $<HTMLButtonElement>('#run')
const $diff_container = $('#diff-container')

const $btn_options = $<HTMLButtonElement>('#btn-options')
const $options = $('#options')
const $diffUnified = $<HTMLInputElement>('#diffUnified')
const $diffIgnoreAllSpace = $('#diffIgnoreAllSpace')
const $diffNameOnly = $('#diffNameOnly')
const $registry = $<HTMLInputElement>('#registry')
const $highlight = $<HTMLInputElement>('#h')
const $outputFormat = $('#f')
const $options_btn_save = $<HTMLButtonElement>('#options-btn-save')
const $options_btn_close = $<HTMLButtonElement>('#options-btn-close')

const $version_picker = $('#version-picker')
const $version_picker_input = $<HTMLInputElement>('#version-picker-input')
const $version_picker_btn = $<HTMLButtonElement>('#version-picker-btn')
const $versions = $<HTMLSelectElement>('#versions')
const $version_picker_error = $('#version-picker-error')
const $version_picker_actions = $('#version-picker-actions')
const $version_picker_btn_close = $<HTMLButtonElement>('#version-picker-btn-close')

$title.ondblclick = function reset(ev) {
  ev.stopPropagation()
  ev.preventDefault()
  location.replace(location.pathname)
}

$btn_options.onclick = function toggle_options() {
  toggle($options)
}

$options_btn_close.onclick = function close_options() {
  hide($options)
}

$options_btn_save.onclick = function save_options() {
  diffUnified = +$diffUnified.value
  if (Number.isNaN(diffUnified) || diffUnified < 0) diffUnified = 3
  diffIgnoreAllSpace = read_boolean($diffIgnoreAllSpace)
  diffNameOnly = read_boolean($diffNameOnly)
  highlight = $highlight.checked
  outputFormat = read_union($outputFormat, 'line-by-line')
  registry = $registry.value
  hide($options)
  refresh_location()
  $run.click()
}

function read_boolean(div: HTMLElement) {
  const elements = div.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  for (const checkbox of elements) {
    if (checkbox.checked) return checkbox.value === 'true'
  }
  return false
}

function read_union(div: HTMLElement, def: string) {
  const elements = div.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  for (const radio of elements) {
    if (radio.checked) return radio.value
  }
  return def
}

function toggle_version_picker() {
  if (toggle($version_picker)) {
    const a = $spec_a.value
    let name: string
    let at = a.indexOf('@', 1)
    if (at > 0) {
      name = a.slice(0, at)
    } else {
      name = a
    }
    $version_picker_input.value = name
    show($version_picker_btn)
    hide($versions)
    refresh_version_picker_btn()
    refresh_version_picker_actions()
  }
}

$version_picker_input.oninput = refresh_version_picker_btn

function refresh_version_picker_btn() {
  const name = $version_picker_input.value
  $version_picker_btn.disabled = !name
}

function is_enter(ev: KeyboardEvent) {
  return ev.key === 'Enter' && !ev.ctrlKey && !ev.altKey && !ev.shiftKey && !ev.metaKey
}

function on_enter(cb: () => void) {
  return function click(ev: KeyboardEvent) {
    if (is_enter(ev)) cb()
  }
}

$version_picker_input.onkeyup = function keyup(ev) {
  if (is_enter(ev)) $version_picker_btn.click()
  else if (ev.key === 'Escape') $version_picker_btn_close.click()
}

$version_picker_btn.onclick = function load_versions() {
  $version_picker_btn.disabled = true
  $version_picker_btn.textContent = 'Loading...'
  const name = $version_picker_input.value
  hide($version_picker_error)
  fetch(`https://data.jsdelivr.com/v1/package/npm/${name}`)
    .then(async (r) => {
      if (r.ok) return r.json()
      else throw new Error(await r.json().then((e) => e.message))
    })
    .then((data) => {
      load_versions_into(name, $versions, data)
    })
    .catch((error) => {
      show($version_picker_error)
      $version_picker_error.textContent = error.message
      $version_picker_btn.disabled = false
      $version_picker_btn.textContent = 'FETCH'
    })
}

function load_versions_into(
  name: string,
  select: HTMLSelectElement,
  data: { tags: Record<string, string>; versions: string[] },
) {
  const { tags, versions } = data
  const invert = new Map<string, string[]>()
  for (const tag in tags) {
    invert.get(tags[tag])?.push(tag) || invert.set(tags[tag], [tag])
  }
  while (select.firstChild) select.removeChild(select.lastChild!)
  for (const v of versions) {
    const option = document.createElement('option')
    option.value = v
    let version = v
    const tags = invert.get(v)
    if (tags) version += ' (' + tags.join(', ') + ')'
    option.textContent = version
    select.appendChild(option)
  }
  if (tags.latest) select.value = tags.latest
  hide($version_picker_btn)
  show($versions)
  $version_picker_btn.textContent = 'FETCH'
  $version_picker_btn.disabled = false
  refresh_version_picker_actions()
  if (select.value && is_first_run) {
    $spec_b.value = name + '@' + select.value
    const i = versions.indexOf(select.value)
    if (i !== -1 && i + 1 < versions.length) $spec_a.value = name + '@' + versions[i + 1]
    $run.focus()
    is_first_run = false
  }
  refresh_location()
}

function refresh_version_picker_actions() {
  toggle($version_picker_actions, $versions.value !== '')
}

$version_picker_actions.onclick = function fill_specs(ev) {
  const fill = (ev.target as HTMLElement).dataset?.fill
  const spec = $version_picker_input.value + '@' + $versions.value
  if (fill === 'a') $spec_a.value = spec
  if (fill === 'b') $spec_b.value = spec
  refresh_location()
}

$version_picker_btn_close.onclick = function close() {
  hide($version_picker)
  $spec_b.focus()
}

function is_valid_input(spec: string) {
  const at = spec.indexOf('@', 1)
  if (at > 0) {
    spec = spec.slice(at + 1)
    return valid(spec)
  }
  return false
}

$spec_a.onkeyup = $spec_b.onkeyup = on_enter(() => {
  const a = $spec_a.value
  const b = $spec_b.value
  if (is_valid_input(a) && is_valid_input(b)) {
    $run.click()
  } else {
    toggle_version_picker()
    $version_picker_btn.click()
  }
})

function refresh_location() {
  const a = $spec_a.value
  const b = $spec_b.value
  if (a && b) {
    let url = location.origin + location.pathname + '?a=' + a + '&b=' + b
    if (diffUnified !== 3) url += '&u=' + diffUnified
    if (diffIgnoreAllSpace) url += '&w=1'
    if (diffNameOnly) url += '&l=1'
    if (highlight === false) url += '&h=0'
    if (outputFormat === 'side-by-side') url += '&f=s'
    if (registry) url += '&r=' + registry
    if (hash) url += '#' + hash
    history.replaceState(null, '', url)
    document.title = a + ' → ' + b
  }
}

$spec_a.oninput = $spec_b.oninput = refresh_location

let cached_spec = ''
let cached_patch = ''

$run.onclick = function run(ev) {
  const a = $spec_a.value
  const b = $spec_b.value
  if (!a || !b) {
    alert('Needs two arguments to compare')
    return
  }
  $run.textContent = 'Loading...'
  $run.disabled = true
  hide($version_picker)
  console.time('diff')

  const spec = [a, b, diffUnified, diffIgnoreAllSpace, diffNameOnly].join()
  if (ev && ev.altKey) {
    run_server_diff()
  } else if (spec === cached_spec) {
    render_patch(cached_patch)
  } else if ([a, b].join() === cached_spec) {
    render_patch(cached_patch, false, true)
  } else {
    diff([a, b], { diffUnified, diffIgnoreAllSpace, diffNameOnly, ...cache_options, registry })
      .then((patch) => {
        cached_spec = spec
        cached_patch = patch
        render_patch(patch)
      })
      .catch(render_error)
  }
}

function restore_run() {
  $run.textContent = 'RUN'
  $run.disabled = false
}

function render_patch(patch: string, nameOnly = diffNameOnly, bigChanges = false) {
  console.timeEnd('diff')
  Object.assign(window, { patch })
  // If only names, convert names to patch format
  if (nameOnly) {
    const lines = patch.split('\n').filter(Boolean)
    let out = ''
    for (const line of lines) {
      out += `diff --git a/${line} b/${line}\n`
    }
    patch = out
  }
  restore_run()
  console.time('diff2html')
  $diff_container.classList.remove('error')
  $diff_container.innerHTML = ''
  const ui = new Diff2HtmlUI($diff_container, patch, {
    diffMaxChanges: bigChanges ? undefined : 2500,
    drawFileList: true,
    fileListStartVisible: nameOnly,
    fileContentToggle: false,
    renderNothingWhenEmpty: nameOnly,
    outputFormat,
    stickyFileHeaders: false,
    highlight,
    highlightLanguages: { cjs: 'javascript' },
  })
  Object.assign(window, { ui })
  ui.draw()
  console.timeEnd('diff2html')
  if (hash) {
    const el = document.getElementById(hash)
    if (el) {
      el.scrollIntoView()
    } else {
      hash = ''
      refresh_location()
    }
  }
}

function render_error(error: Error, try_again = true) {
  console.timeEnd('diff')
  restore_run()
  console.error(error)
  $diff_container.classList.add('error')
  if (try_again) {
    $diff_container.innerHTML = `${error.message}, try again with <button onclick="run_server_diff()">server-side diff</button> ?`
  } else {
    $diff_container.textContent = error.message
  }
}

function run_server_diff() {
  const a = $spec_a.value
  const b = $spec_b.value
  const spec = [a, b].join()
  if (spec === cached_spec) {
    render_patch(cached_patch)
  } else {
    const url = `https://runkit.io/hyrious/git-diff/branches/master/?a=${a}&b=${b}`
    $diff_container.textContent = 'Running diff from server...'
    fetch(url)
      .then((r) => r.text())
      .then((patch) => {
        cached_spec = spec
        cached_patch = patch
        render_patch(patch, false, true)
      })
      .catch((error) => render_error(error, false))
  }
}

Object.assign(window, { run_server_diff })

const query = Object.fromEntries(new URLSearchParams(location.search))
hash = location.hash.slice(1)
if (query.a) $spec_a.value = query.a
if (query.b) $spec_b.value = query.b

if (query.h === '0') highlight = false
$highlight.checked = highlight

if (query.f === 's') outputFormat = 'side-by-side'
$<HTMLInputElement>('#f-' + outputFormat[0]).checked = true

if (query.u) diffUnified = parseInt(query.u)
if (Number.isNaN(diffUnified) || diffUnified < 0) diffUnified = 3
$diffUnified.value = String(diffUnified)

if (query.w === '1') diffIgnoreAllSpace = true
$<HTMLInputElement>('#diffIgnoreAllSpace [value="' + diffIgnoreAllSpace + '"]').checked = true

if (query.l === '1') diffNameOnly = true
$<HTMLInputElement>('#diffNameOnly [value="' + diffNameOnly + '"]').checked = true

if (query.r) registry = query.r
$registry.value = query.r || ''

if (query.a && query.b) $run.click()

refresh_location()

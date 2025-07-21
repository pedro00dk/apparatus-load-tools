import { getShadow } from '@_apparatus_/microfrontend-vite'
import { children, createComputed, createContext, createMemo, createSignal, JSX, Suspense, useContext } from 'solid-js'
import { KebabCase } from 'type-fest'

declare global {
    interface DOMStringMap extends SkeletonDataOptions {}

    interface CSSStyleDeclaration {
        anchorName?: string
        positionAnchor?: string
        positionArea?: string
    }
}

declare module 'solid-js' {
    namespace JSX {
        interface HTMLAttributes<T extends EventTarget> extends SkeletonAttrOptions {
            _?: T
        }
    }
}

type CssAbsoluteUnits = 'px' | 'cm' | 'mm' | 'Q' | 'in' | 'pc' | 'pt'
type CssFontUnits = 'em' | 'rem' | 'ex' | 'ch' | 'cap' | 'ic' | 'lh' | 'rlh'
type CssViewportUnits = `${'' | 's' | 'l' | 'd'}v${'i' | 'b' | 'w' | 'h' | 'min' | 'max'}`
type CssContainerUnits = `cq${'i' | 'b' | 'w' | 'h' | 'min' | 'max'}`
type CssLength = `${number}${CssAbsoluteUnits | CssFontUnits | CssViewportUnits | CssContainerUnits}`

/**
 * Skeleton `dataset` options that can be injected through element data attributes.
 */
type SkeletonDataOptions = {
    /** Skeleton type. */
    sk?: 'none' | 'hide' | 'rect' | 'pill' | 'round' | 'text'
    /** Roundness of `round` skeletons. Defaults to `m`. */
    skR?: 'xs' | 's' | 'm' | 'l' | 'xl'
    /** Match precision of `text` skeletons. Defaults to `last`. (For elements containing text nodes) */
    skT?: 'trim' | 'loose'
    /** Transform origin to scale operations (css property: transform-origin). */
    skO?: string
    /** Scale the skeleton in the X axis (ratio). */
    skSx?: `${number}`
    /** Scale the skeleton in the Y axis (ratio). */
    skSy?: `${number}`
    /** Translate the skeleton in the X axis (css unit). */
    skTx?: CssLength
    /** Translate the skeleton in the Y axis (css unit). */
    skTy?: CssLength
    /** Override skeleton width (css unit). */
    skW?: CssLength
    /** Override skeleton height (css unit). */
    skH?: CssLength
}

/**
 * Skeleton data attribute options.
 *
 * `attr:` prefix is enforced to avoid issues with custom elements.
 */
type SkeletonAttrOptions = {
    [K in keyof SkeletonDataOptions as `attr:data-${KebabCase<K>}`]?: SkeletonDataOptions[K]
} & {
    [K in keyof SkeletonDataOptions as `data-${KebabCase<K>}`]?: never
}

/**
 * Default values for some skeleton options.
 */
const skeletonDefaultOptions = {
    skR: 'm',
    skT: 'trim',
    skO: 'center',
    skSx: '1',
    skSy: '1',
    skTx: '0px',
    skTy: '0px',
} satisfies SkeletonDataOptions

/**
 * Context to be injected inside Suspense fallback only to notify components they are running in skeleton mode.
 */
export const SkeletonContext = createContext(false)

/**
 * Shorthand to access {@linkcode SkeletonContext} directly inside JSX.
 */
export const sk = () => useContext(SkeletonContext)

/**
 * A SolidJS {@linkcode Suspense} wrapper that constructs a skeleton page automatically based on `children`.
 *
 * It works by rendering the children twice, once for the {@linkcode Suspense} `children`, and another for `fallback`.
 * The `fallback` is resolved ahead of time to avoid triggering `Suspense` layers above the current one, and to allow
 * HTML introspection.
 *
 * Note that for the skeleton page work properly, the content of the loading page must te stable. Otherwise, the
 * generated skeleton will be changing together with the loading page content. In order to help with page stabilization,
 * {@linkcode SkeletonContext} and {@linkcode sk} utilities are injected only in the `fallback` page to help adding
 * stabilization conditions.
 */
export const SuspenseSkeleton = (props: { debug?: boolean; children?: JSX.Element }) => {
    const [skeleton, setSkeleton] = createSignal(true)
    const resolved = children(() => <SkeletonContext.Provider value={true} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const cleanup = createMemo(() => inject(getShadow()!, elements(), !!props.debug)())
    createComputed(() => !skeleton() && cleanup())

    return (
        <Suspense fallback={resolved()}>
            {(() => setSkeleton(false)) as unknown as undefined}
            {props.children}
        </Suspense>
    )
}

/**
 * Checks if browser supports css anchors. Or if fallback float mode will be used.
 *
 * The fallback mode uses inset positioning based on the parent container. It works as expected but can misbehave when
 * the page is zoomed in or out, and content shifts.
 */
const mode = CSS.supports('anchor-name: --anchor') ? 'anchor' : 'float'

/**
 * List of element tag names with specific skeleton types.
 */
const types: { [_ in string]?: SkeletonDataOptions } = {
    img: { sk: 'round' },
    picture: { sk: 'round' },
    video: { sk: 'round' },
    svg: { sk: 'round' },
    'sinch-accordion-item': { sk: 'text' },
    'sinch-accordion': { sk: 'none' },
    'sinch-button': { sk: 'round' },
    'sinch-chip': { sk: 'pill' },
    'sinch-field': { sk: 'round' },
    'sinch-link': { sk: 'text' },
    'sinch-segmented-control': { sk: 'none' },
    'sinch-segmented-control-option': { sk: 'rect', skSx: '0.95' },
    'sinch-tabs-option': { sk: 'text', skSx: '0.8' },
    'sinch-tabs': { sk: 'none' },
    'sinch-tag': { sk: 'pill' },
    'sinch-help-tooltip': { sk: 'hide' },
}

/**
 * Border radius values for different skeleton modes and radius.
 */
const radii: { [_ in NonNullable<SkeletonDataOptions['sk' | 'skR']>]: string } = {
    none: '0px',
    hide: '0px',
    text: '0.4lh',
    rect: '0px',
    pill: '1000px',
    round: '8px',
    xs: '2px',
    s: '4px',
    m: '8px',
    l: '12px',
    xl: '16px',
}

/**
 * Generate a css selector that filters out elements that won't participate in the skeleton generation.
 *
 * The following conditions are used:
 * - Element has `data-sk="none"`.
 * - Element is a descendant of `data-sk` ancestor, and itself does not have `data-sk`.
 * - Element is a descendant of {@linkcode implicitType} and it does not have a `data-sk`.
 * - Element in {@linkcode implicitNone} and it does not have a `data-sk`.
 *
 * The conditions above are inverted using css `:not` and `:is` selectors.
 *
 * @param implicitNone Element tags with implicit `data-sk="none"`.
 * @param implicitType Element tags with implicit `data-sk` not `"none"`.
 */
const buildSelector = (implicitNone: string[], implicitType: string[]) => `:not(:is(${[
    '[data-sk="none"]',
    '[data-sk]:not([data-sk="none"]) :not([data-sk])',
    ...implicitType.map(tag => `${tag}:not([data-sk]) :not([data-sk])`),
    ...implicitNone.map(tag => `${tag}:not([data-sk])`),
].join(',\n')}
))`

const inject = (target: ShadowRoot | Element, elements: HTMLElement[], debug: boolean) => () => {
    const container = target.appendChild((<div />) as HTMLElement)
    container.style.position = mode === 'anchor' ? 'static' : 'absolute'
    container.style.pointerEvents = debug ? 'none' : 'auto'

    const implicitNone = Object.entries(types)
        .filter(([, options]) => options?.sk === 'none')
        .map(([tag]) => tag)
    const implicitType = Object.entries(types)
        .filter(([, options]) => options?.sk && options.sk !== 'none')
        .map(([tag]) => tag)
    const selector = buildSelector(implicitNone, implicitType)

    const observer = new ResizeObserver(() => {
        container.innerHTML = ''
        const elementsRects = elements.map(root => root.getBoundingClientRect())
        if (elementsRects.every(rect => !rect.width || !rect.height)) return
        const containerRect = container.getBoundingClientRect()
        elements
            .flatMap(element => {
                const elements = [...element.querySelectorAll<HTMLElement>(selector)]
                if (element.matches(selector)) elements.push(element)
                return elements
            })
            .map(element => ({
                element,
                rect: element.getBoundingClientRect(),
                options: Object.assign({}, skeletonDefaultOptions, types[element.localName], element.dataset),
            }))
            .forEach(({ element, rect, options }, i) => {
                if (options.sk === 'hide') return (element.style.opacity = '0')
                const skeletonRects = computeSkeletons(element, rect, options)
                if (!skeletonRects?.length) return
                observer.observe(element)
                container.append(
                    ...skeletonRects.map(skeletonRect =>
                        renderSkeleton(element, rect, options, containerRect, skeletonRect, `--skeleton-${i}`, debug),
                    ),
                )
            })
    })
    elements.forEach(root => (root.inert = !debug))
    elements.forEach(root => observer.observe(root))
    return () => {
        elements.forEach(root => (root.inert = false))
        container.remove()
        observer.disconnect()
    }
}

const computeSkeletons = (element: HTMLElement, rect: DOMRect, options: SkeletonDataOptions) => {
    if (!rect.height || !rect.width) return
    const { sk, skT } = options
    const customElement = element.localName.includes('-')
    const probablyText = element.childNodes.length > element.childElementCount
    if (!sk && !customElement && !probablyText) return
    if ((sk && sk !== 'text') || (sk === 'text' && !probablyText) || customElement)
        return [new DOMRect(0, 0, rect.width, rect.height)]
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
    return element.childNodes
        .values()
        .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.length)
        .flatMap(node => {
            const range = document.createRange()
            range.setStart(node, 0)
            range.setEnd(node, 1)
            const startRect = range.getBoundingClientRect()
            range.setStart(node, node.textContent!.length - 1)
            range.setEnd(node, node.textContent!.length)
            const endRect = range.getBoundingClientRect()
            const top = startRect.top - rect.top - (lineHeight - startRect.height) / 2
            const left = startRect.left - rect.left
            const right = rect.right - endRect.right
            const lines = Math.round((endRect.bottom - startRect.top) / lineHeight)
            return [...Array(lines)].map(
                (_, i) =>
                    new DOMRect(
                        0.1 + +(i === 0) * left,
                        top + i * lineHeight,
                        rect.width - +(i === 0 && skT === 'trim') * left - +(i === lines - 1 && skT === 'trim') * right,
                        lineHeight,
                    ),
            )
        })
        .toArray()
}

const renderSkeleton = (
    element: HTMLElement,
    rect: DOMRect,
    options: SkeletonDataOptions,
    containerRect: DOMRect,
    skeletonRect: DOMRect,
    anchor: string,
    debug: boolean,
) => {
    const { sk = skeletonRect.left > 0 ? 'text' : 'round' } = options
    const { skR, skO, skSx, skTx, skTy } = options
    const skSy = options.skSy !== '1' ? options.skSy : sk === 'text' ? '0.5' : '1'
    const { skW = `${skeletonRect.width}px`, skH = `${skeletonRect.height}px` } = options
    const skeletonElement = (<div class='animate-pulse bg-surface-secondary-active' />) as HTMLElement
    skeletonElement.style.position = 'absolute'
    skeletonElement.style.positionAnchor = anchor
    skeletonElement.style.positionArea = 'center center'
    skeletonElement.style.alignSelf = 'start'
    skeletonElement.style.justifySelf = 'start'
    skeletonElement.style.borderRadius = radii[sk === 'round' ? skR! : sk]
    element.style.anchorName = anchor
    const float = +(mode === 'float')
    skeletonElement.style.width = skW
    skeletonElement.style.height = skH
    skeletonElement.style.scale = `${skSx} ${skSy}`
    skeletonElement.style.transformOrigin = skO!
    skeletonElement.style.left = `calc(${float * (-containerRect.x + rect.x) + skeletonRect.x}px + ${skTx})`
    skeletonElement.style.top = `calc(${float * (-containerRect.y + rect.y) + skeletonRect.y}px + ${skTy})`
    if (debug) skeletonElement.textContent = `${element.localName} ${element.id || element.className}`
    if (debug) skeletonElement.style.outline = `1px ${sk === 'text' ? 'dashed' : 'solid'} red`
    element.style.opacity = debug ? '1' : '0'
    return skeletonElement
}

import { CssLength, mode } from './util'

declare global {
    interface DOMStringMap extends SkeletonOptions {}
}

/**
 * Skeleton `dataset` options that can be injected through element data attributes.
 */
export type SkeletonOptions = {
    /** Skeleton decoration type. */
    sk?: 'none' | 'hide' | 'rect' | 'pill' | 'round' | 'text'
    /** Roundness of `round` decorations. Defaults to `m`. */
    skR?: 'xs' | 's' | 'm' | 'l' | 'xl'
    /** Match precision of `text` decorations. Defaults to `last`. (For elements containing text nodes) */
    skT?: 'trim' | 'loose'
    /** Transform origin to scale operations (css property: transform-origin). */
    skO?: string
    /** Scale the decoration in the X axis (ratio). */
    skSx?: `${number}`
    /** Scale the decoration in the Y axis (ratio). */
    skSy?: `${number}`
    /** Translate the decoration in the X axis (css unit). */
    skTx?: CssLength
    /** Translate the decoration in the Y axis (css unit). */
    skTy?: CssLength
    /** Override decoration width (css unit). */
    skW?: CssLength
    /** Override decoration height (css unit). */
    skH?: CssLength
}

/**
 * Border radius values for different skeleton decoration modes and radius.
 */
const radii: { [_ in NonNullable<SkeletonOptions['sk' | 'skR']>]: string } = {
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
 * Module configuration, includes default {@linkcode SkeletonOptions}, and render functions for container and skeletons.
 */
const configuration = {
    /** Default {@linkcode SkeletonOptions} for all elements. */
    defaults: { skR: 'm', skT: 'trim', skO: 'center', skSx: '1', skSy: '1', skTx: '0', skTy: '0' } as SkeletonOptions,
    /** Default {@linkcode SkeletonOptions} for specific elements. */
    elements: {
        img: { sk: 'round' },
        picture: { sk: 'round' },
        video: { sk: 'round' },
        svg: { sk: 'round' },
    } as { [_ in string]?: SkeletonOptions },
    /** Default target element for the skeleton container. */
    getTarget: () => document.body as HTMLElement | ShadowRoot,
    /** Render function for the skeleton container element. */
    createContainer: () => {
        const container = document.createElement('div') as HTMLElement
        container.style.zIndex = '1'
        return container
    },
    /** Render function for the skeleton decoration element. */
    createDecoration: () => {
        const decoration = document.createElement('div') as HTMLElement
        decoration.style.background = '#DCE2E5'
        decoration.animate({ opacity: [1, 0.5, 1] }, { duration: 2000, easing: 'ease-in-out', iterations: Infinity })
        return decoration
    },
}

/**
 * Set module {@linkcode configuration}.
 *
 * @param overrides Configuration parts to override.
 */
export const setSkeletonConfiguration = (overrides: Partial<typeof configuration>) => {
    const defaults = { ...configuration.defaults, ...overrides.defaults }
    const elements = { ...configuration.elements, ...overrides.elements }
    Object.assign(configuration, overrides, { defaults, elements })
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

/**
 * Generate the skeleton and inject it into {@linkcode target}.
 *
 * The root {@linkcode elements} and nested element that produced skeleton decorations are subscribed to a listener
 * that recreates skeleton decorations if elements' size change.
 *
 * Elements that produce skeleton decorations will suffer from side effects required to properly display the skeleton:
 * - `element.inert` is set to `true`.
 * - `element.style.opacity` is set to `0`.
 * - `element.style.anchorName` is set to a non empty string.
 *
 * A cleanup function is returned to disconnect the observer and remove the skeleton container from {@linkcode target}.
 *
 * @param elements Elements that are the root (inclusive) to find all decoration candidates.
 * @param target Target to inject the skeleton container.
 * @param debug Enable decorations and options to help debugging skeletons.
 */
export const injectSkeleton = (elements: HTMLElement[], target?: HTMLElement | ShadowRoot, debug?: boolean) => () => {
    target ??= configuration.getTarget()
    const container = target.appendChild(configuration.createContainer())
    container.dataset.about = 'skeleton-container'
    container.style.position = mode === 'anchor' ? 'static' : 'absolute'
    container.style.pointerEvents = debug ? 'none' : ''

    const implicitNone = Object.entries(configuration.elements)
        .filter(([, options]) => options?.sk === 'none')
        .map(([tag]) => tag)
    const implicitType = Object.entries(configuration.elements)
        .filter(([, options]) => options?.sk && options.sk !== 'none')
        .map(([tag]) => tag)
    const selector = buildSelector(implicitNone, implicitType)

    const observer = new ResizeObserver(() => {
        const candidates = [
            ...elements.filter(element => element.matches(selector)),
            ...elements.flatMap(element => [...element.querySelectorAll<HTMLElement>(selector)]),
        ]

        const containerRect = container.getBoundingClientRect()
        const decorationData = candidates.map((element, i) => {
            const anchor = `--skeleton-decoration-${i}`
            const dataset = element.dataset as SkeletonOptions
            const options = { ...configuration.defaults, ...configuration.elements[element.localName], ...dataset }
            const elementRect = element.getBoundingClientRect()
            const decorations = computeDecorations(element, elementRect, options)?.map(decorationRect =>
                createDecoration(options, anchor, decorationRect, elementRect, containerRect),
            )
            return { element, anchor, options, elementRect, decorations }
        })

        container.replaceChildren()
        decorationData.forEach(({ element, anchor, options, decorations }) => {
            if (!decorations?.length) return
            if (!debug) element.style.opacity = '0'
            if (options.sk === 'hide') return
            if (mode === 'anchor') element.style.anchorName = anchor
            observer.observe(element)
            container.append(...decorations)
            if (!debug) return
            decorations.forEach(decoration => {
                decoration.textContent = `${element.localName} ${element.id}`
                decoration.style.outline = `1px ${options.sk === 'text' ? 'dashed' : 'solid'} red`
            })
        })
    })

    elements.forEach(element => (element.inert = !debug))
    elements.forEach(element => observer.observe(element))

    return () => observer.disconnect()
}

/**
 * Compute skeleton decorations for a given {@linkcode element}.
 *
 * At this point, the computation does not take all {@linkcode options} into consideration, except for
 * {@linkcode SkeletonOptions.sk} and {@linkcode SkeletonOptions.skT}.
 *
 * @param element Element to compute skeleton decorations.
 * @param rect {@linkcode element}'s rect.
 * @param options {@linkcode element}'s resolved options.
 */
const computeDecorations = (element: HTMLElement, rect: DOMRect, options: SkeletonOptions) => {
    if (!rect.height || !rect.width) return
    const { sk, skT } = options
    const customElement = element.localName.includes('-')
    const probablyText = element.childNodes.length > element.childElementCount
    if (!sk && !customElement && !probablyText) return
    if ((sk && sk !== 'text') || (sk === 'text' && !probablyText) || customElement)
        return [new DOMRect(0, 0, rect.width, rect.height)]
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
            const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
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

/**
 * Create a skeleton decoration element for the given {@linkcode options}, {@linkcode anchor} name, and rects.
 *
 * @param options Element's resolved {@linkcode SkeletonOptions}.
 * @param anchor Anchor name to be used if {@linkcode mode} is `"anchor"`.
 * @param decorationRect Decoration rect computed by {@linkcode computeDecorations}.
 * @param elementRect Element rect required if {@linkcode mode} is `"float"`.
 * @param containerRect Container rect required if {@linkcode mode} is `"float"`.
 */
const createDecoration = (
    options: SkeletonOptions,
    anchor: string,
    decorationRect: DOMRect,
    elementRect: DOMRect,
    containerRect: DOMRect,
) => {
    const { sk = decorationRect.left > 0 ? 'text' : 'round' } = options
    const { skR, skO, skSx, skTx, skTy } = options
    const skSy = options.skSy !== '1' ? options.skSy : sk === 'text' ? '0.5' : '1'
    const { skW = `${decorationRect.width}px`, skH = `${decorationRect.height}px` } = options
    const float = +(mode === 'float')
    const decoration = configuration.createDecoration()
    decoration.style.position = 'absolute'
    decoration.style.positionAnchor = anchor
    decoration.style.positionArea = 'center center'
    decoration.style.alignSelf = 'start'
    decoration.style.justifySelf = 'start'
    decoration.style.borderRadius = radii[sk === 'round' ? skR! : sk]
    decoration.style.width = skW
    decoration.style.height = skH
    decoration.style.scale = `${skSx} ${skSy}`
    decoration.style.transformOrigin = skO!
    decoration.style.left = `calc(${decorationRect.x + float * (elementRect.x - containerRect.x)}px + ${skTx})`
    decoration.style.top = `calc(${decorationRect.y + float * (elementRect.y - containerRect.y)}px + ${skTy})`
    return decoration
}

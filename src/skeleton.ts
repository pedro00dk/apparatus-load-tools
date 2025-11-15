import { CssLength } from './util'

declare global {
    interface DOMStringMap extends SkeletonOptions {}
}

/**
 * Skeleton `dataset` options that can be injected through element data attributes.
 */
export type SkeletonOptions = {
    /** Skeleton subtree ID. Subtrees with different IDs are not selected for generation. */
    skId?: string
    /** Display skeletons. */
    sk?: `${boolean}`
    /** Skeleton type. */
    skT?: 'none' | 'hide' | 'rect' | 'pill' | 'round' | 'text'
    /** Roundness of `round` skeletons. Defaults to `m`. */
    skR?: 'xs' | 's' | 'm' | 'l' | 'xl'
    /** Transform origin to scale operations (css property: transform-origin). */
    skO?: string
    /** Scale in the X axis (ratio). */
    skSx?: `${number}`
    /** Scale in the Y axis (ratio). */
    skSy?: `${number}`
    /** Translate in the X axis (css unit). */
    skTx?: CssLength
    /** Translate in the Y axis (css unit). */
    skTy?: CssLength
    /** Override width (css unit). */
    skW?: CssLength
    /** Override height (css unit). */
    skH?: CssLength
    /** Skeleton z-index. */
    skZ?: `${number}`
}

/**
 * Border radius values for different skeleton decoration modes and radius.
 */
const radii: { [_ in NonNullable<SkeletonOptions['skT' | 'skR']>]: string } = {
    none: '0px',
    hide: '0px',
    rect: '0px',
    pill: '1000px',
    round: '8px',
    text: '0.4lh',
    xs: '2px',
    s: '4px',
    m: '8px',
    l: '12px',
    xl: '16px',
}

/**
 * Module configuration, includes default {@linkcode SkeletonOptions}, and a skeleton factory.
 */
const configuration = {
    /** Default {@linkcode SkeletonOptions}. */
    defaults: {
        skR: 'm',
        skTT: 'trim',
        skO: 'center',
        skSx: '1',
        skSy: '1',
        skTx: '0px',
        skTy: '0px',
    } as Omit<SkeletonOptions, 'sk' | 'skT'>,
    /** Default {@linkcode SkeletonOptions} for specific elements. */
    elements: {
        img: { skT: 'round' },
        picture: { skT: 'round' },
        video: { skT: 'round' },
        svg: { skT: 'round' },
    } as { [_ in string]?: Omit<SkeletonOptions, 'skId' | 'sk'> },
    /** Skeleton factory. */
    factory: () => {
        const skeleton = document.createElement('div') as HTMLElement
        skeleton.style.background = '#DCE2E5'
        skeleton.animate({ opacity: [1, 0.5, 1] }, { duration: 2000, easing: 'ease-in-out', iterations: Infinity })
        return skeleton
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
 * Listen for {@linkcode element}'s `[data-sk]` and inject skeletons.
 *
 * The overlay is generated using {@linkcode configuration.factory}.
 *
 * Elements side effects:
 * - `element.children`: Skeletons appended.
 * - `element.style.position`: Set to `relative`.
 * - `element.style.opacity`: Set to `0`.
 * - `element.style.visibility`: Set to `hidden`.
 *
 * Skeleton side effects:
 * - `overlay.slot`: If required using `dataset` options.
 * - `overlay.dataset`: Prevent recursive skeleton computation.
 *
 * A cleanup function is returned to unsubscribe listeners and remove the skeletons.
 *
 * @param element Root element to listen for skeleton candidates.
 * @param debug Enable debug decorations.
 */
export const injectSkeleton = (element: HTMLElement, debug?: boolean) => {
    const id = element.dataset.skId ?? 'default'
    const position = getComputedStyle(element).position
    const implicitHide = Object.entries(configuration.elements)
        .filter(([, options]) => options?.skT === 'none')
        .map(([tag]) => tag)
    const implicitShow = Object.entries(configuration.elements)
        .filter(([, options]) => options?.skT && options.skT !== 'none')
        .map(([tag]) => tag)
    const selector = buildSelector(id, implicitHide, implicitShow)

    let skeletonObserver: ResizeObserver | undefined
    const skeletonElements = new Map<
        HTMLElement,
        {
            opacity: string
            visibility: string
            options: SkeletonOptions
            rect: DOMRect
            positions: DOMRect[]
            skeletons: HTMLElement[]
        }
    >()

    const inject = () => {
        if (!position || position === 'static') element.style.position = 'relative'
        const observer = new ResizeObserver(() => {
            skeletonElements.entries().forEach(([el, { skeletons }]) => {
                el.style.opacity = skeletonElements.get(el)!.opacity
                el.style.visibility = skeletonElements.get(el)!.visibility
                skeletons.forEach(skeleton => skeleton.remove())
            })
            skeletonElements.clear()

            const candidates = [
                ...[element].filter(element => element.matches(selector)),
                ...element.querySelectorAll<HTMLElement>(selector),
            ]
            const { defaults, elements } = configuration
            const container = element.getBoundingClientRect()
            candidates.forEach(element => {
                const opacity = element.style.opacity
                const visibility = element.style.visibility
                const options = { ...defaults, ...elements[element.localName], ...element.dataset }
                const rect = element.getBoundingClientRect()
                const positions = computePositions(element, options, rect)
                if (!positions?.length) return
                skeletonElements.set(element, { opacity, visibility, options, rect, positions, skeletons: [] })
            })
            skeletonElements.entries().forEach(([el, { options, rect, positions }]) => {
                if (!debug && el !== element) el.style.opacity = '0'
                if (!debug && el === element) el.style.visibility = 'hidden'
                if (options.skT === 'hide') return
                const skeletons = positions.map(position => createSkeleton(options, position, rect, container, !!debug))
                element.append(...(skeletonElements.get(el)!.skeletons = skeletons))
                observer.observe(el)
            })
        })
        observer.observe(element)
        skeletonObserver = observer
    }

    const eject = () => {
        element.style.position = position
        skeletonObserver?.disconnect()
        skeletonElements.entries().forEach(([el, { skeletons }]) => {
            el.style.opacity = skeletonElements.get(el)!.opacity
            el.style.visibility = skeletonElements.get(el)!.visibility
            skeletons.forEach(skeleton => skeleton.remove())
        })
        skeletonElements.clear()
    }

    const enabledObserver = new MutationObserver(() => (element.dataset.sk === 'true' ? inject() : eject()))
    const removedObserver = new ResizeObserver(() => !element.parentElement && eject())
    enabledObserver.observe(element, { attributes: true, attributeFilter: ['data-sk'] })
    removedObserver.observe(element)
    if (element.dataset.sk === 'true') inject()

    return () => {
        enabledObserver.disconnect()
        removedObserver.disconnect()
        eject()
    }
}

/**
 * Generate a css selector that filters out elements that won't participate in the skeleton generation.
 *
 * The following conditions are used:
 * - Element is the root of a different `data-sk-id`.
 * - Element is a descendent of the root of a different `data-sk-id` (within the query scope).
 * - Element has `data-sk="none"`.
 * - Element is a descendant of `data-sk!="none"` ancestor, and itself does not have `data-sk`.
 * - Element in {@linkcode implicitNone} and it does not have a `data-sk`.
 * - Element is a descendant of {@linkcode implicitType} and it does not have a `data-sk`.
 *
 * The conditions above are inverted using css `:not` and `:is` selectors.
 *
 * @param id Skeleton subtree ID.
 * @param implicitNone Element tags with implicit `data-sk="none"`.
 * @param implicitType Element tags with implicit `data-sk` not `"none"`.
 */
const buildSelector = (id: string, implicitNone: string[], implicitType: string[]) => `:not(:is(${[
    `:scope [data-sk-id]:not([data-sk-id="${id}"])`,
    `:scope [data-sk-id]:not([data-sk-id="${id}"]) *`,
    ':scope [data-sk-t="none"]',
    ':scope [data-sk-t]:not([data-sk-t="none"]) :not([data-sk-t])',
    ...implicitNone.map(tag => `:scope ${tag}:not([data-sk-t])`),
    ...implicitType.map(tag => `:scope ${tag}:not([data-sk-t]) :not([data-sk-t])`),
].join(',\n')}
))`

/**
 * Compute skeleton positions for a given {@linkcode element}.
 *
 * @param element Element to compute skeleton decorations.
 * @param options {@linkcode element}'s resolved options.
 * @param rect {@linkcode element}'s rect.
 */
const computePositions = (element: HTMLElement, options: SkeletonOptions, rect: DOMRect) => {
    if (!rect.height || !rect.width) return
    const { skT } = options
    const customElement = element.localName.includes('-')
    const probablyText = element.childNodes.length > element.childElementCount
    if (!skT && !customElement && !probablyText) return
    if ((skT && skT !== 'text') || (skT === 'text' && !probablyText) || customElement)
        return [new DOMRect(0, 0, rect.width, rect.height)]
    return element.childNodes
        .values()
        .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.length)
        .flatMap(node => {
            const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
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
            return generate(
                lines,
                line =>
                    new DOMRect(
                        left * +(line === 0) + 0.1,
                        top + line * lineHeight,
                        rect.width - left * +(line === 0) - right * +(line === lines - 1),
                        lineHeight,
                    ),
            )
        })
        .toArray()
}

/**
 * Create a skeleton element using {@linkcode configuration.factory} and add layout properties.
 *
 * @param options Element's resolved {@linkcode SkeletonOptions}.
 * @param skeletonRect Skeleton size.
 * @param elementRect Element position.
 * @param containerRect Container (root element) position.
 * @param debug Show debug decorations.
 */
const createSkeleton = (
    options: SkeletonOptions,
    skeletonRect: DOMRect,
    elementRect: DOMRect,
    containerRect: DOMRect,
    debug: boolean,
) => {
    const { skT: skM = skeletonRect.left > 0 ? 'text' : 'round' } = options
    const { skR, skO, skSx, skTx, skTy } = options
    const skSy = options.skSy !== '1' ? options.skSy : skM === 'text' ? '0.5' : '1'
    const { skW = `${skeletonRect.width}px`, skH = `${skeletonRect.height}px` } = options
    const skeleton = configuration.factory()
    skeleton.dataset.skT = 'none'
    skeleton.style.position = 'absolute'
    skeleton.style.left = `calc(${skeletonRect.x + elementRect.x - containerRect.x}px + ${skTx})`
    skeleton.style.top = `calc(${skeletonRect.y + elementRect.y - containerRect.y}px + ${skTy})`
    skeleton.style.width = skW
    skeleton.style.height = skH
    skeleton.style.zIndex = options.skZ!
    skeleton.style.scale = `${skSx} ${skSy}`
    skeleton.style.transformOrigin = skO!
    skeleton.style.zIndex = '1'
    skeleton.style.borderRadius = radii[skM === 'round' ? skR! : skM]
    skeleton.style.visibility = 'visible'
    if (debug) {
        skeleton.inert = true
        skeleton.style.opacity = '0.5'
        skeleton.style.outline = `1px ${skM === 'text' ? 'dashed' : 'solid'} red`
    }
    return skeleton
}

/**
 * Return a generator that yields values from `fn` function for `count` iterations.
 *
 * @param count Number of iterations.
 * @param fn Producer function.
 */
function* generate<T>(count: number, fn: (index: number) => T) {
    for (let i = 0; i < count; i++) yield fn(i)
}

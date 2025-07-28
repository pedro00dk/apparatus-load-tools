import { CssLength } from './util'

declare global {
    interface DOMStringMap extends SkeletonOptions {}
}

/**
 * Skeleton `dataset` options that can be injected through element data attributes.
 */
export type SkeletonOptions = {
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
    } as SkeletonOptions,
    /** Default {@linkcode SkeletonOptions} for specific elements. */
    elements: {
        img: { skT: 'round' },
        picture: { skT: 'round' },
        video: { skT: 'round' },
        svg: { skT: 'round' },
    } as { [_ in string]?: SkeletonOptions },
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
    '[data-sk-t="none"]',
    '[data-sk-t]:not([data-sk-t="none"]) :not([data-sk-t])',
    ...implicitType.map(tag => `${tag}:not([data-sk-t]) :not([data-sk-t])`),
    ...implicitNone.map(tag => `${tag}:not([data-sk-t])`),
].join(',\n')}
))`

/**
 * Compute skeleton decorations for a given {@linkcode element}.
 *
 * At this point, the computation does not take all {@linkcode options} into consideration, except for
 * {@linkcode SkeletonOptions.skT}.
 *
 * @param element Element to compute skeleton decorations.
 * @param rect {@linkcode element}'s rect.
 * @param options {@linkcode element}'s resolved options.
 */
const computeDecorations = (element: HTMLElement, rect: DOMRect, options: SkeletonOptions) => {
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
                        rect.width - +(i === 0) * left - +(i === lines - 1) * right,
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
    const implicitHide = Object.entries(configuration.elements)
        .filter(([, options]) => options?.skT === 'none')
        .map(([tag]) => tag)
    const implicitShow = Object.entries(configuration.elements)
        .filter(([, options]) => options?.skT && options.skT !== 'none')
        .map(([tag]) => tag)
    const selector = buildSelector(implicitHide, implicitShow)

    let skeletonElements: HTMLElement[] = []
    let skeletonObserver: ResizeObserver | undefined

    const inject = () => {
        const observer = new ResizeObserver(() => {
            skeletonElements.forEach(skeleton => skeleton.remove())
            skeletonElements.length = 0

            const candidates = [
                ...[element].filter(element => element.matches(selector)),
                ...element.querySelectorAll<HTMLElement>(selector),
            ]

            const containerRect = element.getBoundingClientRect()
            candidates
                .map(element => {
                    const dataset = element.dataset as SkeletonOptions
                    const options = {
                        ...configuration.defaults,
                        ...configuration.elements[element.localName],
                        ...dataset,
                    }
                    const elementRect = element.getBoundingClientRect()
                    const skeletonRects = computeDecorations(element, elementRect, options)
                    return { options, element, elementRect, skeletonRects }
                })
                .forEach(({ element: el, options, elementRect, skeletonRects }) => {
                    if (!skeletonRects?.length) return
                    if (!debug && el !== element) el.style.opacity = '0'
                    if (!debug && el === element) el.style.visibility = 'hidden'
                    if (options.skT === 'hide') return
                    const skeletons = (skeletonRects ?? []).map(skeletonRect =>
                        createSkeleton(options, skeletonRect, elementRect, containerRect, !!debug),
                    )
                    skeletonElements.push(...skeletons)
                    element.append(...skeletons)
                    observer.observe(element)
                })
        })
        observer.observe(element)
        skeletonObserver = observer
    }

    const eject = () => {
        skeletonObserver?.disconnect()
        skeletonElements.forEach(element => element.remove())
    }

    const enabledObserver = new MutationObserver(() => {
        const options = { ...configuration.defaults, ...element.dataset }
        if (options.sk === 'true') inject()
        else eject()
    })

    const removedObserver = new ResizeObserver(
        ([{ borderBoxSize: size }]) => size[0].blockSize === 0 && size[0].inlineSize === 0 && eject(),
    )

    const position = getComputedStyle(element).position
    element.style.position = !position || position === 'static' ? 'relative' : position
    enabledObserver.observe(element, { attributes: true, attributeFilter: ['data-sk'] })
    if (element.dataset.sk === 'true') inject()

    return () => {
        enabledObserver.disconnect()
        removedObserver.disconnect()
        skeletonObserver?.disconnect()
        skeletonElements.forEach(element => element.remove())
    }
}

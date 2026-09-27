declare global {
    interface DOMStringMap extends SkeletonOptions {}
}

type CssAbsoluteUnits = 'px' | 'cm' | 'mm' | 'Q' | 'in' | 'pc' | 'pt'
type CssFontUnits = 'em' | 'rem' | 'ex' | 'ch' | 'cap' | 'ic' | 'lh' | 'rlh'
type CssViewportUnits = `${'' | 's' | 'l' | 'd'}v${'i' | 'b' | 'w' | 'h' | 'min' | 'max'}`
type CssContainerUnits = `cq${'i' | 'b' | 'w' | 'h' | 'min' | 'max'}`
type CssLength = `${number}${CssAbsoluteUnits | CssFontUnits | CssViewportUnits | CssContainerUnits}`

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
 * Inject skeletons into {@linkcode element}'s and listen for its `[data-sk]` attribute.
 *
 * Elements side effects:
 * - `element.style.position`: Set to `relative` if `static`.
 * - `element.style.opacity`: Set to `0`.
 * - `element.inert`: Set to `true` when skeletons are enabled.
 * - `element.children`: Skeletons appended when enabled.
 *
 * A cleanup function is returned to remove the skeletons and listener.
 *
 * @param element Root element to listen for skeleton candidates.
 * @param options Options for the skeleton injection.
 */
export const injectSkeleton = (
    element: HTMLElement,
    options: {
        factory?: () => HTMLElement
        defaults?: Omit<SkeletonOptions, 'sk' | 'skT'>
        elements?: { [_ in string]?: Omit<SkeletonOptions, 'sk'> }
        debug?: boolean
    } = {},
) => {
    const { factory = createSkeleton, defaults = {}, elements: el = {}, debug = false } = options
    const elements: typeof el = { img: { skT: 'round' }, video: { skT: 'round' }, svg: { skT: 'round' }, ...el }

    const position = getComputedStyle(element).position
    if (!position || position === 'static') element.style.position = 'relative'

    const { sk = 'false' } = element.dataset
    element.dataset.sk = sk

    const skeletons = new Map<
        HTMLElement,
        {
            visibility: string
            opacity: string
            options: SkeletonOptions
            rect: DOMRect
            positions: DOMRect[]
            elements: HTMLElement[]
        }
    >()

    const inject = () => {
        element.inert = true
        skeletonObserver.observe(element)
    }

    const eject = () => {
        element.inert = false
        skeletonObserver.disconnect()
        skeletons.entries().forEach(([element, { opacity, elements }]) => {
            element.style.opacity = opacity
            elements.forEach(skeleton => skeleton.remove())
        })
        skeletons.clear()
    }

    const implicitNone = Object.entries(elements)
        .filter(([, options]) => options?.skT === 'none')
        .map(([tag]) => tag)
    const implicitShow = Object.entries(elements)
        .filter(([, options]) => options?.skT && options.skT !== 'none')
        .map(([tag]) => tag)
    const selector = buildSelector(implicitNone, implicitShow)

    const skeletonObserver = new ResizeObserver(() => {
        skeletons.entries().forEach(([element, { opacity, elements }]) => {
            element.style.opacity = opacity
            elements.forEach(skeleton => skeleton.remove())
        })
        skeletons.clear()

        const container = element.getBoundingClientRect()
        const candidates = [
            ...[element].filter(element => element.matches(selector)),
            ...element.querySelectorAll<HTMLElement>(selector),
        ]

        candidates.forEach(element => {
            const visibility = element.style.visibility
            const opacity = element.style.opacity
            const options = { ...defaults, ...elements[element.localName], ...element.dataset }
            const rect = element.getBoundingClientRect()
            const positions = computePositions(element, options, rect)
            if (!positions?.length) return
            skeletons.set(element, { visibility, opacity, options, rect, positions, elements: [] })
        })
        skeletons.entries().forEach(([el, { options, rect, positions }]) => {
            if (!debug && el === element) el.style.visibility = 'hidden'
            if (!debug && el !== element) el.style.opacity = '0'
            if (options.skT === 'hide') return
            const elements = positions.map(position =>
                computeStyles(factory(), options, rect, container, position, debug),
            )
            element.append(...(skeletons.get(el)!.elements = elements))
            skeletonObserver.observe(el)
        })
    })

    const enabledObserver = new MutationObserver(() => (element.dataset.sk === 'true' ? inject() : eject()))
    enabledObserver.observe(element, { attributes: true, attributeFilter: ['data-sk'] })
    if (sk === 'true') inject()

    return () => {
        enabledObserver.disconnect()
        eject()
    }
}

/**
 * Generate a CSS selector to select candidate elements for skeleton generation.
 *
 * The following conditions are used to exclude elements, all within the :scope subtree:
 * 1. Root of a different injection (`data-sk` present).
 * 2. Descendent of a different injection (`data-sk` present).
 * 3. Element has `data-sk-t="none"`.
 * 4. Descendant of `data-sk-t!="none"` and does not have `data-sk`.
 * 5. In {@linkcode implicitNone} and it does not have a `data-sk` (similar to 3).
 * 6. Descendant of {@linkcode implicitType} and it does not have a `data-sk` (similar to 4).
 *
 * The conditions above are inverted using css `:not(:is(...))` selectors.
 *
 * @param implicitNone Element tags with implicit `data-sk="none"`.
 * @param implicitType Element tags with implicit `data-sk` not `"none"`.
 */
const buildSelector = (implicitNone: string[], implicitType: string[]) => `:not(:is(${[
    `:scope [data-sk]`,
    `:scope [data-sk] *`,
    ':scope [data-sk-t="none"]',
    ':scope [data-sk-t]:not([data-sk-t="none"]) :not([data-sk-t])',
    ...implicitNone.map(tag => `:scope ${tag}:not([data-sk-t])`),
    ...implicitType.map(tag => `:scope ${tag}:not([data-sk-t]) :not([data-sk-t])`),
].join(',\n')}
))`

/**
 * Compute skeleton positions for a given element.
 *
 * @param element Element to compute skeleton decorations.
 * @param options Element's resolved options.
 * @param rect Element's rect.
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
            return Array.from(
                { length: lines },
                (_, i) =>
                    new DOMRect(
                        left * +(i === 0) + 0.1,
                        top + i * lineHeight,
                        rect.width - left * +(i === 0) - right * +(i === lines - 1),
                        lineHeight,
                    ),
            )
        })
        .toArray()
}

/**
 * From a skeleton element and its computed positions, compute the necessary styles.
 *
 * @param skeleton Skeleton element.
 * @param options Element's resolved options.
 * @param rect Element position.
 * @param containerRect Container (root element) position.
 * @param skeletonRect Skeleton size.
 * @param debug Show debug decorations.
 */
const computeStyles = (
    skeleton: HTMLElement,
    options: SkeletonOptions,
    rect: DOMRect,
    containerRect: DOMRect,
    skeletonRect: DOMRect,
    debug: boolean,
) => {
    const { skT: skM = skeletonRect.left > 0 ? 'text' : 'round' } = options
    const { skR = 'm', skO = 'center', skSx = '1', skSy: skSy_ = '1', skTx = '0px', skTy = '0px', skZ = '1' } = options
    const skSy = skSy_ !== '1' ? skSy_ : skM === 'text' ? '0.5' : '1'
    const { skW = `${skeletonRect.width}px`, skH = `${skeletonRect.height}px` } = options
    skeleton.dataset.skT = 'none'
    skeleton.style.position = 'absolute'
    skeleton.style.left = `calc(${skeletonRect.x + rect.x - containerRect.x}px + ${skTx})`
    skeleton.style.top = `calc(${skeletonRect.y + rect.y - containerRect.y}px + ${skTy})`
    skeleton.style.width = skW
    skeleton.style.height = skH
    skeleton.style.zIndex = skZ
    skeleton.style.scale = `${skSx} ${skSy}`
    skeleton.style.transformOrigin = skO
    skeleton.style.borderRadius = radii[skM === 'round' ? skR! : skM]
    skeleton.style.visibility = 'visible'
    if (debug) {
        skeleton.inert = true
        skeleton.style.opacity = '0.5'
        skeleton.style.outline = `1px ${skM === 'text' ? 'double' : 'solid'} red`
    }
    return skeleton
}

/**
 * Create a default skeleton element.
 */
export const createSkeleton = () => {
    const skeleton = document.createElement('skeleton-')
    skeleton.style.background = '#DCE2E5'
    skeleton.animate({ opacity: [1, 0.5, 1] }, { duration: 2000, easing: 'ease-in-out', iterations: Infinity })
    return skeleton
}

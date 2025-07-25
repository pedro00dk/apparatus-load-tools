declare global {
    interface DOMStringMap extends SkeletonOptions {}

    interface CSSStyleDeclaration {
        anchorName?: string
        positionAnchor?: string
        positionArea?: string
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
export type SkeletonOptions = {
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
 * Checks if browser supports css anchors. Or if fallback float mode will be used.
 *
 * The fallback mode uses inset positioning based on the parent container. It works as expected but can misbehave when
 * the page is zoomed in or out, and content shifts.
 */
const mode = CSS.supports('anchor-name: --anchor') ? 'anchor' : 'float'

/**
 * Border radius values for different skeleton modes and radius.
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
    defaults: {
        skR: 'm',
        skT: 'trim',
        skO: 'center',
        skSx: '1',
        skSy: '1',
        skTx: '0px',
        skTy: '0px',
    } as SkeletonOptions,
    /** Default {@linkcode SkeletonOptions} for specific elements. */
    elements: {
        img: { sk: 'round' },
        picture: { sk: 'round' },
        video: { sk: 'round' },
        svg: { sk: 'round' },
    } as { [_ in string]?: SkeletonOptions },
    /** Render function for the container element. */
    createContainer: () => {
        const container = document.createElement('div')
        const style = container.appendChild(document.createElement('style'))
        style.textContent = '@keyframes load-skeleton-pulse { 50% { opacity: 0.5; } }'
        return container as HTMLElement
    },
    /** Render function for the skeleton element. */
    createSkeleton: () => {
        const skeleton = document.createElement('div')
        skeleton.style.background = '#DCE2E5'
        skeleton.style.animation = 'load-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        return skeleton as HTMLElement
    },
}

/**
 * Set module {@linkcode configuration}.
 *
 * @param overrides Configuration parts to override.
 */
export const setConfiguration = (overrides: Partial<typeof configuration>) => {
    const elements = Object.assign(configuration.elements, overrides.elements)
    Object.assign(configuration, overrides, { elements })
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
 * Generate skeletons and inject them to {@linkcode target}.
 *
 * The root elements and element that produced skeletons are subscribed to a listener internally that will update
 * skeletons if the elements contents change.
 *
 * Elements that produce skeletons will suffer from side effects required to properly display the skeletons, they are:
 * - `element.style.opacity` is set to `0`.
 * - `element.style.anchorName` is set to a non empty string.
 * - `element.inert` is set to `true`.
 *
 * Return a cleanup function to disconnect observers and remove the skeleton container from {@linkcode target}.
 *
 * @param target Target to append the skeleton container.
 * @param elements Elements that are the root (inclusive) to find all candidates to skeleton creation.
 * @param debug Enable decorations and options to help debugging skeletons.
 */
export const inject = (target: Element | ShadowRoot, elements: HTMLElement[], debug: boolean) => () => {
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
        const skeletonData = candidates.map((element, i) => {
            const anchor = `--skeleton-${i}`
            const dataset = element.dataset as SkeletonOptions
            const options = { ...configuration.defaults, ...configuration.elements[element.localName], ...dataset }
            const elementRect = element.getBoundingClientRect()
            const skeletons = computeSkeletons(element, elementRect, options)?.map(skeletonRect =>
                createSkeleton(options, anchor, skeletonRect, elementRect, containerRect),
            )
            return { element, anchor, options, elementRect, skeletons }
        })

        container.replaceChildren()
        skeletonData.forEach(({ element, anchor, options, skeletons }) => {
            if (!skeletons?.length) return
            if (!debug) element.style.opacity = '0'
            if (options.sk === 'hide') return
            observer.observe(element)
            if (mode === 'anchor') element.style.anchorName = anchor
            if (debug)
                skeletons.forEach(skeleton => {
                    skeleton.textContent = `${element.localName} ${element.id}`
                    skeleton.style.outline = `1px ${options.sk === 'text' ? 'dashed' : 'solid'} red`
                })
            container.append(...skeletons)
        })
    })

    const container = target.appendChild(configuration.createContainer())
    container.style.position = mode === 'anchor' ? '' : 'absolute'
    container.style.pointerEvents = debug ? 'none' : ''
    elements.forEach(root => (root.inert = !debug))
    elements.forEach(root => observer.observe(root))
    return [container, () => observer.disconnect()] as const
}

/**
 * Compute skeletons for a given {@linkcode element}.
 *
 * At this point, the computation does not take all {@linkcode options} into consideration, except for
 * {@linkcode SkeletonOptions.sk} and {@linkcode SkeletonOptions.skT}.
 *
 * @param element Element to compute skeletons.
 * @param rect {@linkcode element}'s rect.
 * @param options {@linkcode element}'s resolved options.
 */
const computeSkeletons = (element: HTMLElement, rect: DOMRect, options: SkeletonOptions) => {
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
 * Create a skeleton element for the given {@linkcode options}, {@linkcode anchor} name, and rects.
 *
 * @param options Element's resolved {@linkcode SkeletonOptions}.
 * @param anchor Anchor name to be used if {@linkcode mode} is `"anchor"`.
 * @param skeletonRect Skeleton rect computed by {@linkcode computeSkeletons}.
 * @param elementRect Element rect required if {@linkcode mode} is `"float"`.
 * @param containerRect Container rect required if {@linkcode mode} is `"float"`.
 */
const createSkeleton = (
    options: SkeletonOptions,
    anchor: string,
    skeletonRect: DOMRect,
    elementRect: DOMRect,
    containerRect: DOMRect,
) => {
    const { sk = skeletonRect.left > 0 ? 'text' : 'round' } = options
    const { skR, skO, skSx, skTx, skTy } = options
    const skSy = options.skSy !== '1' ? options.skSy : sk === 'text' ? '0.5' : '1'
    const { skW = `${skeletonRect.width}px`, skH = `${skeletonRect.height}px` } = options
    const float = +(mode === 'float')
    const skeleton = configuration.createSkeleton()
    skeleton.style.position = 'absolute'
    skeleton.style.positionAnchor = anchor
    skeleton.style.positionArea = 'center center'
    skeleton.style.alignSelf = 'start'
    skeleton.style.justifySelf = 'start'
    skeleton.style.borderRadius = radii[sk === 'round' ? skR! : sk]
    skeleton.style.width = skW
    skeleton.style.height = skH
    skeleton.style.scale = `${skSx} ${skSy}`
    skeleton.style.transformOrigin = skO!
    skeleton.style.left = `calc(${skeletonRect.x + float * (elementRect.x - containerRect.x)}px + ${skTx})`
    skeleton.style.top = `calc(${skeletonRect.y + float * (elementRect.y - containerRect.y)}px + ${skTy})`
    return skeleton
}

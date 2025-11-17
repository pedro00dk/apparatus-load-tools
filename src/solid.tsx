import {
    children,
    createComputed,
    createContext,
    createMemo,
    createSignal,
    createUniqueId,
    JSX,
    onCleanup,
    onMount,
    ResolvedChildren,
    Show,
    splitProps,
    Suspense,
    useContext,
} from 'solid-js'
import { injectOverlay, type OverlayOptions } from './overlay.ts'
import { injectSkeleton, type SkeletonOptions } from './skeleton.ts'
import { OptionsToAttributes } from './util.ts'

declare module 'solid-js' {
    namespace JSX {
        interface IntrinsicElements {
            'sk-overlay': HTMLAttributes<HTMLElement>
        }

        interface HTMLAttributes<T extends EventTarget>
            extends OptionsToAttributes<OverlayOptions>,
                OptionsToAttributes<SkeletonOptions> {
            _?: T
        }
    }
}

/**
 * Inject an overlay into the parent of this element using {@linkcode injectOverlay}.
 *
 * @param props {@linkcode OverlayOptions}.
 * @param props.when Alternative to {@linkcode OverlayOptions.ov} to mimic {@linkcode Show} (higher priority).
 */
export const Overlay = (props: OverlayOptions & { when?: boolean }) => {
    const [, overlayProps] = splitProps(props, ['when'])
    const [stub, setStub] = createSignal<HTMLDivElement>()
    const parent = createMemo(() => stub()?.parentElement)
    const [cleanup, setCleanup] = createSignal<() => void>()

    createComputed(() => parent() && setCleanup(() => injectOverlay(parent()!)))
    createComputed(() => {
        if (!parent()) return
        const options: OverlayOptions = { ...overlayProps, ov: `${props.when ?? props.ov ?? false}` }
        Object.assign(parent()!.dataset, options)
        parent()!.inert = options.ov === 'true'
    })

    onCleanup(() => cleanup?.())

    return <sk-overlay ref={setStub} style={{ display: 'none' }} />
}

/**
 * SolidJS {@linkcode Show}-like wrapper for {@linkcode injectOverlay}.
 *
 * The wrapper also make {@linkcode children} `inert` if the overlay is enabled.
 *
 * @param props {@linkcode OverlayOptions}.
 * @param props.when Alternative to {@linkcode OverlayOptions.ov} to mimic {@linkcode Show} (higher priority).
 * @param props.children Elements to render, if many, each will have its own overlay.
 */
export const ShowOverlay = (props: OverlayOptions & { when?: boolean; children?: JSX.Element }) => {
    const [, overlayProps] = splitProps(props, ['children'])
    const resolved = children(() => props.children)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const record = new Map<HTMLElement, () => void>()

    createComputed(() => {
        const exited = [...record.keys()].filter(element => !elements().includes(element))
        const entered = elements().filter(element => !record.has(element))
        exited.forEach(element => (record.get(element)!(), record.delete(element)))
        entered.forEach(element => record.set(element, injectOverlay(element)))
    })

    createComputed(() => {
        const options: OverlayOptions = { ...overlayProps, ov: `${props.when ?? props.ov ?? false}` }
        elements().forEach(element => Object.assign(element.dataset, options))
        elements().forEach(element => (element.inert = options.ov === 'true'))
    })

    onCleanup(() => record.values().forEach(cleanup => cleanup()))

    return <>{resolved()}</>
}

/**
 * Skeleton context to notify components rendering skeletons.
 */
export const SkeletonContext = createContext((): boolean => false)

/**
 * SolidJS {@linkcode Show}-like wrapper for {@linkcode injectSkeleton}.
 *
 * @param props {@linkcode SkeletonOptions}.
 * @param props.when Enable skeletons.
 * @param props.debug Enable skeleton debug mode.
 * @param children Children to render and generate skeletons for.
 */
export const ShowSkeleton = (props: { when?: boolean; debug?: boolean; children?: JSX.Element }) => {
    const skId = createUniqueId()
    const ancestorInFallback = useContext(SkeletonContext)
    const inFallback = createMemo(() => !!props.when || ancestorInFallback())

    const resolved = children(() => <SkeletonContext.Provider value={inFallback} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const record = new Map<HTMLElement, () => void>()

    createComputed(() => {
        const exited = [...record.keys()].filter(element => !elements().includes(element))
        const entered = elements().filter(element => !record.has(element))
        exited.forEach(element => (record.get(element)!(), record.delete(element)))
        entered.forEach(element => record.set(element, injectSkeleton(element, props.debug)))
    })

    createComputed(() => {
        elements().forEach(element => Object.assign(element.dataset, { skId, sk: `${inFallback()}` }))
        elements().forEach(element => (element.inert = !props.debug && element.dataset.sk === 'true'))
    })

    onCleanup(() => record.values().forEach(cleanup => cleanup()))

    return <>{resolved()}</>
}

/**
 * SolidJS {@linkcode Suspense}-like wrapper for {@linkcode injectSkeleton}.
 *
 * If there are any pending resources and fallback is rendered, skeletons will be injected into child elements.
 * If an ancestor skeleton root is already rendering fallback, children skeletons will also be forced into fallback.
 *
 * Note that for the skeleton page work properly, the content of the loading page must be stable. Otherwise, the
 * generated skeleton will change together with the loading page content.
 *
 * @param props.debug Enable skeleton debug mode.
 * @param props.children Children to render and generate skeletons for.
 */
export const SuspenseSkeleton = (props: { debug?: boolean; children?: JSX.Element }) => {
    const skId = createUniqueId()
    const ancestorInFallback = useContext(SkeletonContext)
    const [currentInFallback, setCurrentInFallback] = createSignal(false)
    const inFallback = createMemo(() => currentInFallback() || ancestorInFallback())

    const [resolvedChildren, setResolvedChildren] = createSignal<ResolvedChildren>()
    const elements = createMemo(() => [resolvedChildren()].flat().filter(element => element instanceof HTMLElement))

    const record = new Map<HTMLElement, () => void>()

    createComputed(() => {
        elements().forEach(element => Object.assign(element.dataset, { skId, sk: `${inFallback()}` }))
        elements().forEach(element => (element.inert = !props.debug && element.dataset.sk === 'true'))
    })

    createComputed(() => {
        const exited = [...record.keys()].filter(element => !elements().includes(element))
        const entered = elements().filter(element => !record.has(element))
        exited.forEach(element => (record.get(element)!(), record.delete(element)))
        entered.forEach(element => record.set(element, injectSkeleton(element, props.debug)))
    })

    onCleanup(() => elements().forEach(element => (record.get(element)!(), record.delete(element))))

    const FallbackDetector = () => {
        onMount(() => setCurrentInFallback(true))
        onCleanup(() => setCurrentInFallback(false))
        return undefined
    }

    return (
        <SkeletonContext.Provider value={inFallback}>
            <Suspense fallback={[<>{resolvedChildren()}</>, FallbackDetector()]}>
                {setResolvedChildren(children(() => props.children))}
            </Suspense>
        </SkeletonContext.Provider>
    )
}

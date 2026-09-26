import { JSX } from '@solidjs/web'
import {
    children,
    createComponent,
    createContext,
    createMemo,
    createRenderEffect,
    createSignal,
    createUniqueId,
    onCleanup,
    onSettled,
    ResolvedChildren,
    Show,
    useContext,
} from 'solid-js'
import { injectOverlay } from './overlay.ts'
import { injectSkeleton, type SkeletonOptions } from './skeleton.ts'

/**
 * Context for overlay injection options.
 */
export const OverlayOptions = createContext<Parameters<typeof injectOverlay>[1]>({})

/**
 * SolidJS {@linkcode Show}-like wrapper for {@linkcode injectOverlay}.
 *
 * @param props.when Whether to show the overlay.
 * @param props.children Elements to render, if many, each will have its own overlay.
 */
export const ShowOverlay = (props: { when?: boolean; children?: JSX.Element }): JSX.Element => {
    const resolved = children(() => props.children)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const overlayOptions = useContext(OverlayOptions)
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), props.when, overlayOptions] as const,
        ([elements, when, overlayOptions]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectOverlay(element, overlayOptions)))
            exited.forEach(element => (record.get(element)!(), record.delete(element)))
            elements.forEach(element => (element.dataset.ov = `${!!when}`))
        },
    )

    onSettled(() => () => record.values().forEach(cleanup => cleanup()))

    return [resolved]
}

/**
 * Inject an overlay into the parent of this component using {@linkcode injectOverlay}.
 *
 * @param props.when Whether to show the overlay.
 */
export const Overlay = (props: { when?: boolean }): JSX.Element => {
    const stub = document.createElement('x-overlay-probe')
    stub.style.display = 'none'
    onSettled(() => void (stub.parentElement && setElements([stub.parentElement]), stub.remove()))
    const [elements, setElements] = createSignal<HTMLElement[]>([])
    const overlayOptions = useContext(OverlayOptions)
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), props.when, overlayOptions] as const,
        ([elements, when, overlayOptions]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectOverlay(element, overlayOptions)))
            exited.forEach(element => (record.get(element)!(), record.delete(element)))
            elements.forEach(element => (element.dataset.ov = `${!!when}`))
        },
    )

    onSettled(() => () => record.values().forEach(cleanup => cleanup()))

    return [stub]
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
export const ShowSkeleton = (props: { when?: boolean; debug?: boolean; children?: JSX.Element }): JSX.Element => {
    const ancestorInFallback = useContext(SkeletonContext)
    const show = createMemo(() => !!props.when || ancestorInFallback())
    const resolved = children(() =>
        // prettier-ignore
        createComponent(SkeletonContext, { get value() { return show }, get children( ){ return props.children }}),
    )
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), props.when, props.debug] as const,
        ([elements, when, debug]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectSkeleton(element, debug)))
            exited.forEach(element => (record.get(element)!(), record.delete(element)))
            elements.forEach(element => (element.dataset.sk = `${!!when}`))
        },
    )

    onSettled(() => () => record.values().forEach(cleanup => cleanup()))

    return [resolved]
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

    // createComputed(() => {
    //     elements().forEach(element => Object.assign(element.dataset, { skId, sk: `${inFallback()}` }))
    //     elements().forEach(element => (element.inert = !props.debug && element.dataset.sk === 'true'))
    // })

    // createComputed(() => {
    //     const exited = [...record.keys()].filter(element => !elements().includes(element))
    //     const entered = elements().filter(element => !record.has(element))
    //     exited.forEach(element => (record.get(element)!(), record.delete(element)))
    //     entered.forEach(element => record.set(element, injectSkeleton(element, props.debug)))
    // })

    onCleanup(() => elements().forEach(element => (record.get(element)!(), record.delete(element))))

    const FallbackDetector = () => {
        // onMount(() => setCurrentInFallback(true))
        onCleanup(() => setCurrentInFallback(false))
        return undefined
    }

    // return (
    //     <SkeletonContext.Provider value={inFallback}>
    //         <Suspense fallback={[<>{resolvedChildren()}</>, FallbackDetector()]}>
    //             {setResolvedChildren(children(() => props.children))}
    //         </Suspense>
    //     </SkeletonContext.Provider>
    // )
}

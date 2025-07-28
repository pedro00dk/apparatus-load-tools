import {
    children,
    createComputed,
    createContext,
    createMemo,
    createSignal,
    JSX,
    onCleanup,
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

    return <i ref={setStub} style={{ display: 'none !important' }} />
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
export const SkeletonContext = createContext(false)

/**
 * Shorthand to access {@linkcode SkeletonContext} inside JSX.
 */
export const sk = () => useContext(SkeletonContext)

/**
 * SolidJS {@linkcode Show}-like wrapper for {@linkcode injectSkeleton}.
 *
 * @param props {@linkcode SkeletonOptions}.
 * @param props.when Alternative to {@linkcode SkeletonOptions.sk} to mimic {@linkcode Show} (higher priority).
 * @param props.debug Enable skeleton debug mode.
 * @param children Children to render and generate skeletons for.
 */
export const ShowSkeleton = (props: SkeletonOptions & { when?: boolean; debug?: boolean; children?: JSX.Element }) => {
    const [, skeletonProps] = splitProps(props, ['children'])
    const resolved = children(() => <SkeletonContext.Provider value={true} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const record = new Map<HTMLElement, () => void>()

    createComputed(() => {
        const exited = [...record.keys()].filter(element => !elements().includes(element))
        const entered = elements().filter(element => !record.has(element))
        exited.forEach(element => (record.get(element)!(), record.delete(element)))
        entered.forEach(element => record.set(element, injectSkeleton(element, props.debug)))
    })

    createComputed(() => {
        const options: SkeletonOptions = { ...skeletonProps, sk: `${props.when ?? props.sk ?? false}` }
        elements().forEach(element => Object.assign(element.dataset, options))
        elements().forEach(element => (element.inert = !props.debug && options.sk === 'true'))
    })

    onCleanup(() => record.values().forEach(cleanup => cleanup()))

    return <>{resolved()}</>
}

/**
 * SolidJS {@linkcode Suspense}-like wrapper for {@linkcode injectSkeleton}.
 *
 * It works by rendering {@linkcode children} twice, for the {@linkcode Suspense} `children` for `fallback`.
 * `fallback` is resolved ahead of time to avoid triggering {@linkcode Suspense} layers above, and for introspection.
 *
 * Note that for the skeleton page work properly, the content of the loading page must te stable. Otherwise, the
 * generated skeleton will be changing together with the loading page content. In order to help with page stabilization,
 * {@linkcode SkeletonContext} and {@linkcode sk} utilities are injected only in the `fallback` page to help adding
 * stabilization conditions.
 *
 * @param props {@linkcode SkeletonOptions}, the {@linkcode SkeletonOptions.sk} is discard for the suspense state.
 * @param props.debug Enable skeleton debug mode.
 * @param children Children to render and generate skeletons for.
 */
export const SuspenseSkeleton = (props: SkeletonOptions & { debug?: boolean; children?: JSX.Element }) => {
    const [, skeletonProps] = splitProps(props, ['children'])
    const resolved = children(() => <SkeletonContext.Provider value={true} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const record = new Map<HTMLElement, () => void>()

    createComputed(() => {
        const exited = [...record.keys()].filter(element => !elements().includes(element))
        const entered = elements().filter(element => !record.has(element))
        exited.forEach(element => (record.get(element)!(), record.delete(element)))
        entered.forEach(element => record.set(element, injectSkeleton(element, props.debug)))
    })

    createComputed(() => {
        elements().forEach(element => Object.assign(element.dataset, skeletonProps, { sk: 'true' } as SkeletonOptions))
        elements().forEach(element => !props.debug && (element.inert = true))
    })

    onCleanup(() => record.values().forEach(cleanup => cleanup()))

    return <Suspense fallback={elements()}>{props.children}</Suspense>
}

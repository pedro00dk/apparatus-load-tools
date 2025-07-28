import {
    children,
    createComputed,
    createContext,
    createMemo,
    createSignal,
    JSX,
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
 * SolidJS wrapper for {@linkcode injectOverlay}.
 *
 * The wrapper also make children inert if the overlay is enabled.
 *
 * @param props {@linkcode OverlayOptions} and children, should usually be a single child.
 */
export const Overlay = (props: OverlayOptions & { children?: JSX.Element }) => {
    const [, overlayProps] = splitProps(props, ['children'])
    const resolved = children(() => props.children)
    const childrenArray = createMemo(() => resolved.toArray())
    const record = new Map<HTMLElement, () => void>()

    createComputed(() => {
        const elements = childrenArray().filter(child => child instanceof HTMLElement)
        const entered = elements.filter(element => !record.has(element))
        const exited = [...record.keys()].filter(element => !elements.includes(element))
        entered.forEach(element => record.set(element, injectOverlay(element)))
        exited.forEach(element => (record.get(element)!(), record.delete(element)))
    })

    createComputed(() => {
        const elements = childrenArray().filter(child => child instanceof HTMLElement)
        elements.forEach(element => Object.assign(element.dataset, overlayProps))
        elements.forEach(element => (element.inert = element.dataset.ov === 'true'))
    })

    return <>{childrenArray()}</>
}

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
 * The `fallback` is resolved ahead of time to avoid triggering `Suspense` layers above, and to allow introspection.
 *
 * Note that for the skeleton page work properly, the content of the loading page must te stable. Otherwise, the
 * generated skeleton will be changing together with the loading page content. In order to help with page stabilization,
 * {@linkcode SkeletonContext} and {@linkcode sk} utilities are injected only in the `fallback` page to help adding
 * stabilization conditions.
 *
 * @param target Target to inject the skeleton container.
 * @param debug Enable debug mode.
 * @param children Children to render and generate skeletons for.
 */
export const SuspenseSkeleton = (props: {
    //
    target?: HTMLElement | ShadowRoot
    debug?: boolean
    children?: JSX.Element
}) => {
    const [suspended, setSuspended] = createSignal(true)
    const resolved = children(() => <SkeletonContext.Provider value={true} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const cleanup = createMemo(() => injectSkeleton(elements(), props.target, props.debug)())
    createComputed(() => !suspended() && cleanup())

    return (
        <Suspense fallback={elements()}>
            {(() => setSuspended(false)) as unknown as undefined}
            {props.children}
        </Suspense>
    )
}

/**
 * A SolidJS {@linkcode Show} wrapper that constructs a skeleton page automatically based on `children`.
 *
 * It works by rendering the children twice, once for the {@linkcode Show} `children`, and another for `fallback`.
 * The `fallback` is resolved ahead of time to avoid triggering `Suspense` layers above, and to allow introspection.
 *
 * @param when {@linkcode Show} when property.
 * @param target Target to inject the skeleton container.
 * @param debug Enable debug mode.
 * @param children Children to render and generate skeletons for.
 */
export const ShowSkeleton = (props: {
    //
    when: boolean
    target: HTMLElement | ShadowRoot
    debug?: boolean
    children?: JSX.Element
}) => {
    const resolved = children(() => <SkeletonContext.Provider value={true} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const cleanup = createMemo(() => injectSkeleton(elements(), props.target, props.debug)())
    createComputed(() => props.when && cleanup())

    return (
        <Show when={props.when} fallback={elements()}>
            {props.children}
        </Show>
    )
}

import {
    children,
    createComputed,
    createContext,
    createMemo,
    createSignal,
    JSX,
    Show,
    Suspense,
    useContext,
} from 'solid-js'
import { KebabCase } from 'type-fest'
import { inject, type SkeletonOptions } from './skeleton.ts'

declare module 'solid-js' {
    namespace JSX {
        interface HTMLAttributes<T extends EventTarget> extends SkeletonAttributes {
            _?: T
        }
    }
}

/**
 * Skeleton data attribute options.
 *
 * `attr:` prefix is enforced to avoid issues with custom elements.
 */
type SkeletonAttributes = {
    [K in keyof SkeletonOptions as `attr:data-${KebabCase<K>}`]?: SkeletonOptions[K]
} & {
    [K in keyof SkeletonOptions as `data-${KebabCase<K>}`]?: never
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
    const cleanup = createMemo(() => inject(elements(), props.target, props.debug)())
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
    const cleanup = createMemo(() => inject(elements(), props.target, props.debug)())
    createComputed(() => props.when && cleanup())

    return (
        <Show when={props.when} fallback={elements()}>
            {props.children}
        </Show>
    )
}

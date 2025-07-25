import { children, createComputed, createContext, createMemo, createSignal, JSX, Suspense, useContext } from 'solid-js'
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
 * The `fallback` is resolved ahead of time to avoid triggering `Suspense` layers above the current one, and to allow
 * HTML introspection.
 *
 * Note that for the skeleton page work properly, the content of the loading page must te stable. Otherwise, the
 * generated skeleton will be changing together with the loading page content. In order to help with page stabilization,
 * {@linkcode SkeletonContext} and {@linkcode sk} utilities are injected only in the `fallback` page to help adding
 * stabilization conditions.
 */
export const SuspenseSkeleton = (props: {
    //
    target: Element | ShadowRoot
    debug?: boolean
    children?: JSX.Element
}) => {
    const [suspended, setSuspended] = createSignal(true)
    const resolved = children(() => <SkeletonContext.Provider value={true} children={props.children} />)
    const elements = createMemo(() => resolved.toArray().filter(element => element instanceof HTMLElement))
    const cleanup = createMemo(() => inject(props.target, elements(), !!props.debug)())
    createComputed(() => !suspended() && cleanup())

    return (
        <Suspense fallback={elements()}>
            {(() => setSuspended(false)) as unknown as undefined}
            {props.children}
        </Suspense>
    )
}

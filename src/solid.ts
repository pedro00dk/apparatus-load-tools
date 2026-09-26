import { JSX } from '@solidjs/web'
import {
    children,
    createComponent,
    createContext,
    createMemo,
    createRenderEffect,
    createSignal,
    Loading,
    onSettled,
    ResolvedElement,
    Show,
    useContext,
} from 'solid-js'
import { injectOverlay } from './overlay.ts'
import { injectSkeleton } from './skeleton.ts'

/**
 * Context for overlay injection options.
 */
export const OverlayContext = createContext<Parameters<typeof injectOverlay>[1]>({})

/**
 * Context for skeleton injection options.
 */
export const SkeletonContext = createContext<Parameters<typeof injectSkeleton>[1]>({})

/**
 * SolidJS {@linkcode Show}-like wrapper for {@linkcode injectOverlay}.
 *
 * @param props.when Whether to show the overlay.
 * @param props.children Elements to render, if many, each will have its own overlay.
 */
export const ShowOverlay = (props: { when?: boolean; children?: JSX.Element }): JSX.Element => {
    const resolved = createMemo(() => children(() => props.children).toArray())
    const elements = createMemo(() => resolved().filter(element => element instanceof HTMLElement))
    const options = useContext(OverlayContext)
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), props.when] as const,
        ([elements, when]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectOverlay(element, options)))
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
    const probe = document.createElement('x-overlay-probe')
    probe.style.display = 'none'
    onSettled(() => void (probe.parentElement && setElements([probe.parentElement]), probe.remove()))
    const [elements, setElements] = createSignal<HTMLElement[]>([])
    const options = useContext(OverlayContext)
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), props.when] as const,
        ([elements, when]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectOverlay(element, options)))
            exited.forEach(element => (record.get(element)!(), record.delete(element)))
            elements.forEach(element => (element.dataset.ov = `${!!when}`))
        },
    )

    onSettled(() => () => record.values().forEach(cleanup => cleanup()))

    return [probe]
}

/**
 * Skeleton context to notify components rendering skeletons.
 */
export const SkeletonFallback = createContext((): boolean => false)

/**
 * SolidJS {@linkcode Show}-like wrapper for {@linkcode injectSkeleton}.
 *
 * @param props.when Whether to show the skeleton.
 * @param props.debug Whether to enable debug mode.
 * @param props.children Elements to render, if many, each will have its own skeleton.
 */
export const ShowSkeleton = (props: { when?: boolean; debug?: boolean; children?: JSX.Element }): JSX.Element => {
    const ancestorInFallback = useContext(SkeletonFallback)
    const when = createMemo(() => !!props.when || ancestorInFallback())
    const resolved = createMemo(() => children(() => props.children).toArray())
    const elements = createMemo(() => resolved().filter(element => element instanceof HTMLElement))
    const options = useContext(SkeletonContext)
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), when(), props.debug] as const,
        ([elements, when, debug]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectSkeleton(element, { ...options, debug })))
            exited.forEach(element => (record.get(element)!(), record.delete(element)))
            elements.forEach(element => (element.dataset.sk = `${!!when}`))
        },
    )

    onSettled(() => () => record.values().forEach(cleanup => cleanup()))

    return createComponent(SkeletonFallback, {
        get value() {
            return when
        },
        get children() {
            return resolved()
        },
    })
}

/**
 * SolidJS {@linkcode Loading}-like wrapper for {@linkcode injectSkeleton}.
 *
 * @param props.debug Whether to enable debug mode.
 * @param props.children Elements to render, if many, each will have its own skeleton.
 */
export const LoadingSkeleton = (props: { debug?: boolean; children?: JSX.Element }) => {
    const ancestorInFallback = useContext(SkeletonFallback)
    const [currentInFallback, setCurrentInFallback] = createSignal(false)
    const when = createMemo(() => currentInFallback() || ancestorInFallback())
    const [resolved, setResolved] = createSignal<ResolvedElement[]>([], { ownedWrite: true })
    const elements = createMemo(() => resolved().filter(element => element instanceof HTMLElement))
    const options = useContext(SkeletonContext)
    const record = new Map<HTMLElement, () => void>()

    createRenderEffect(
        () => [elements(), when(), props.debug] as const,
        ([elements, when, debug]) => {
            const entered = elements.filter(element => !record.has(element))
            const exited = [...record.keys()].filter(element => !elements.includes(element))
            entered.forEach(element => record.set(element, injectSkeleton(element, { ...options, debug })))
            exited.forEach(element => (record.get(element)!(), record.delete(element)))
            elements.forEach(element => (element.dataset.sk = `${!!when}`))
        },
    )

    onSettled(() => () => record.values().forEach(cleanup => cleanup()))

    return createComponent(SkeletonFallback, {
        get value() {
            return when
        },
        get children() {
            return createComponent(Loading, {
                get children() {
                    const resolved = children(() => props.children).toArray()
                    setResolved(resolved)
                    onSettled(() => void setCurrentInFallback(false))
                    return resolved
                },
                get fallback() {
                    onSettled(() => void setCurrentInFallback(true))
                    return resolved()
                },
            })
        },
    })
}

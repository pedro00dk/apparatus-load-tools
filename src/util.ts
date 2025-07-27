import { KebabCase } from 'type-fest'

declare global {
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

/**
 * Type for css length strings.
 */
export type CssLength = '0' | `${number}${CssAbsoluteUnits | CssFontUnits | CssViewportUnits | CssContainerUnits}`

/**
 * Convert `dataset` options to html `data-` attributes.
 *
 * `attr:` prefix is enforced to avoid issues with custom elements.
 *
 * @param TOptions Dataset options.
 */
export type OptionsToAttributes<TOptions extends object> = {
    [K in keyof TOptions as `attr:data-${KebabCase<K & string>}`]?: TOptions[K]
} & {
    [K in keyof TOptions as `data-${KebabCase<K & string>}`]?: never
}

/**
 * Checks if browser supports css anchors. Or if fallback float mode will be used.
 *
 * The fallback mode uses inset positioning based on the parent container. It works as expected but can misbehave when
 * the page is zoomed in or out, and content shifts.
 */
export const mode = CSS.supports('anchor-name: --anchor') ? 'anchor' : 'float'

const spinnerSvg = `
<svg fill="none" viewBox="0 0 50 50" stroke="#1A2126">
    <circle cx="25" cy="25" r="22" opacity=".3"/>
    <path d="M25 3a22 22 0 0 1 22 22" />
</svg>
`

const configuration = {
    createOverlay: () => {
        const overlay = document.createElement('i')
        const spinner = overlay.appendChild(document.createElement('svg'))
        spinner.outerHTML = spinnerSvg
        return overlay
    },
}

export const setOverlayConfiguration = (overrides: Partial<typeof configuration>) => {
    Object.assign(configuration, overrides)
}

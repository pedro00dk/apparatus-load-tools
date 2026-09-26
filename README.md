# @\_apparatus\_/load-tools

[![bundle size](https://deno.bundlejs.com/?q=@_apparatus_/load-tools&badge=detailed)](https://bundlejs.com/?q=@_apparatus_/load-tools)

Easily create loading skeletons and overlays that adapt to content at runtime.

## Installation

```sh
npm install @_apparatus_/load-tools
```

## Features

- ⏱️ **Loading overlays** - Add spinners and loading indicators that cover content
- 💀 **Runtime skeletons** - Generate skeletons at runtime that match your content layout
- 🎯 **Data attributes** - Control behavior through simple HTML data attributes
- ⚛️ **Solid.js integration** - Ready-to-use components for reactive applications
- 🔧 **Highly configurable** - Customize appearance, animations, and behavior

## Examples

### Basic Overlay Usage

```ts
import { injectOverlay } from '@_apparatus_/load-tools'

const container = document.querySelector('#content')

// Inject overlay functionality
const cleanup = injectOverlay(container)

// Control via data attribute
container.dataset.ov = 'true' // Show overlay
container.dataset.ov = 'false' // Hide overlay

// Cleanup when done
cleanup()
```

### Overlay with HTML Data Attributes

```html
<div id="content" data-ov="true" data-ov-in="300" data-ov-out="200" data-ov-z="10">
    <!-- Your content here -->
</div>

<script>
    import { injectOverlay } from '@_apparatus_/load-tools'

    // The overlay will automatically respect the data attributes
    const cleanup = injectOverlay(document.querySelector('#content'))
</script>
```

### Custom Overlay

```ts
import { injectOverlay } from '@_apparatus_/load-tools'

// Pass a custom overlay factory to this injection
const cleanup = injectOverlay(document.querySelector('#content'), {
    factory: () => {
        const overlay = document.createElement('div')
        overlay.style.background = 'rgba(0, 0, 0, 0.5)'
        overlay.style.display = 'grid'
        overlay.style.placeItems = 'center'

        const spinner = document.createElement('div')
        spinner.className = 'custom-spinner'
        overlay.appendChild(spinner)

        return overlay
    },
})
```

### Basic Skeleton Usage

```ts
import { injectSkeleton } from '@_apparatus_/load-tools'

const container = document.querySelector('#content')

// Inject skeleton functionality
const cleanup = injectSkeleton(container)

// Control via data attribute
container.dataset.sk = 'true' // Show skeletons
container.dataset.sk = 'false' // Hide skeletons

// Cleanup when done
cleanup()
```

### Skeleton Types and Customization

```html
<!-- Different skeleton types -->
<div data-sk="true">
    <!-- Text skeleton (auto-detected for text content) -->
    <p>This text will have a skeleton overlay</p>

    <!-- Rectangle skeleton -->
    <div data-sk-t="rect" style="width: 200px; height: 100px"></div>

    <!-- Pill skeleton (rounded ends) -->
    <button data-sk-t="pill">Button</button>

    <!-- Round skeleton (for avatars, icons) -->
    <img data-sk-t="round" data-sk-r="xl" src="avatar.jpg" />

    <!-- No skeleton for this element -->
    <span data-sk-t="none">Always visible</span>
</div>

<script>
    import { injectSkeleton } from '@_apparatus_/load-tools'
    injectSkeleton(document.querySelector('[data-sk]'))
</script>
```

### Skeleton Transformations

```html
<div data-sk="true">
    <!-- Scale skeleton -->
    <div data-sk-t="rect" data-sk-sx="0.8" data-sk-sy="0.5">Content</div>

    <!-- Translate skeleton position -->
    <div data-sk-t="rect" data-sk-tx="10px" data-sk-ty="-5px">Content</div>

    <!-- Override dimensions -->
    <div data-sk-t="rect" data-sk-w="100%" data-sk-h="50px">Content</div>

    <!-- Transform origin -->
    <div data-sk-t="rect" data-sk-o="top left" data-sk-sx="0.5">Content</div>
</div>
```

### Skeleton Configuration

```ts
import { injectSkeleton } from '@_apparatus_/load-tools'

// Configure defaults and element-specific types for this injection
const cleanup = injectSkeleton(document.querySelector('#content'), {
    defaults: {
        skR: 'l', // Default roundness: xs, s, m, l, xl
        skO: 'center', // Transform origin
        skSx: '1', // Scale X
        skSy: '1', // Scale Y
    },
    elements: {
        // Custom defaults for specific elements
        img: { skT: 'round', skR: 'xl' },
        button: { skT: 'pill' },
        input: { skT: 'pill' },
    },
    factory: () => {
        const skeleton = document.createElement('div')
        skeleton.style.background = 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)'
        skeleton.style.backgroundSize = '200% 100%'
        skeleton.animate({ backgroundPosition: ['200% 0', '-200% 0'] }, { duration: 1500, iterations: Infinity })
        return skeleton
    },
})
```

### Solid.js Integration - Overlay

```tsx
import { Overlay, OverlayContext, ShowOverlay } from '@_apparatus_/load-tools/solid'
import { createSignal } from 'solid-js'

const App = () => {
    const [loading, setLoading] = createSignal(false)

    return (
        <>
            <OverlayContext value={{ factory: () => document.createElement('div') }}>
                <div>
                    <Overlay when={loading()} />
                    <p>Content that will be covered by overlay</p>
                </div>
            </OverlayContext>

            {/* ShowOverlay - wraps children with overlay */}
            <ShowOverlay when={loading()}>
                <div class='card'>
                    <h2>Card Title</h2>
                    <p>Card content</p>
                </div>
            </ShowOverlay>

            <button onClick={() => setLoading(!loading())}>Toggle Loading</button>
        </>
    )
}
```

### Solid.js Integration - Skeleton

```tsx
import { ShowSkeleton, SkeletonContext } from '@_apparatus_/load-tools/solid'
import { createSignal, For } from 'solid-js'

const UserProfile = (props: { avatar: string; name: string; bio: string }) => {
    return (
        <div class='profile'>
            <img data-sk-t='round' src={props.avatar} />
            <h2>{props.name}</h2>
            <p>{props.bio}</p>
        </div>
    )
}

const App = () => {
    const [loading, setLoading] = createSignal(true)
    const [users] = createSignal([{ avatar: 'avatar.jpg', name: 'Ada', bio: 'Engineer' }])

    return (
        <SkeletonContext value={{ defaults: { skR: 'l' } }}>
            <ShowSkeleton when={loading()}>
                <For each={users()}>{user => <UserProfile {...user} />}</For>
            </ShowSkeleton>
            <button onClick={() => setLoading(!loading())}>Toggle skeleton</button>
        </SkeletonContext>
    )
}
```

### Complete Loading State Example

```tsx
import { ShowOverlay, ShowSkeleton } from '@_apparatus_/load-tools/solid'
import { createResource } from 'solid-js'

const Dashboard = () => {
    const [data] = createResource(fetchDashboardData)

    return (
        <div class='dashboard'>
            {/* Show overlay during initial load */}
            <ShowOverlay when={data.loading}>
                <div class='dashboard-content'>
                    {/* Show skeletons for content structure */}
                    <ShowSkeleton when={data.loading}>
                        <div class='stats-grid'>
                            <div class='stat-card' data-sk-t='rect'>
                                <h3>{data()?.total ?? 'Loading...'}</h3>
                                <p>Total Users</p>
                            </div>
                            <div class='stat-card' data-sk-t='rect'>
                                <h3>{data()?.active ?? 'Loading...'}</h3>
                                <p>Active Users</p>
                            </div>
                        </div>

                        <div class='chart' data-sk-t='round' data-sk-r='m'>
                            <Chart data={data()?.chartData} />
                        </div>
                    </ShowSkeleton>
                </div>
            </ShowOverlay>
        </div>
    )
}
```

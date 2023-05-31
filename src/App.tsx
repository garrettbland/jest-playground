// import './style.css'
// import './styles/xterm.css'
import 'xterm/css/xterm.css'
import { WebContainer } from '@webcontainer/api'
import { files as systemFiles } from './files'
import { useState, useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import Editor, { Monaco } from '@monaco-editor/react'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import JestType from './jest-type'
import { tokenColors } from './cobalt-tokens.json'
import { colors } from './cobalt-colors.json'

/**
 * Default file values
 */
const FILES = {
    'app.js': systemFiles.src.directory['app.js'].file.contents,
    'app.test.js': systemFiles.src.directory['app.test.js'].file.contents,
}
// const FILES = {
//     'app.js': '// loading...',
//     'app.test.js': '// loading...',
// }

const TAB_THEME = {
    cobalt2: {
        backgroundColor: 'bg-[#193549]',
        activeTextColor: 'text-white',
        textColor: 'text-blue-100',
        underlineColor: 'border-blue-500',
    },
    'vs-dark': {
        backgroundColor: 'bg-[#1E1E1E]',
        activeTextColor: 'text-white',
        textColor: 'text-gray-100',
        underlineColor: 'border-blue-500',
    },
    light: {
        backgroundColor: 'bg-[#FFFFFE]',
        activeTextColor: 'text-blue-500',
        textColor: 'text-gray-900',
        underlineColor: 'border-blue-500',
    },
}

export const App = () => {
    const [fileName, setFileName] = useState<keyof typeof FILES>('app.js')
    const [files, setFiles] = useState(FILES)
    const file = files[fileName]
    const webContainerInstance = useRef<WebContainer>()
    const terminalRef = useRef<HTMLDivElement>(null)
    const [isContainerReady, setContainerReady] = useState(false)
    const editorRef = useRef(null)
    const [isEditorReady, setEditorReady] = useState(false)
    const [shareText, setShareText] = useState('Share')
    const [theme, setTheme] = useState<keyof typeof TAB_THEME>('cobalt2')
    const currentTabTheme = TAB_THEME[theme]

    // const appRef = useRef<string>('')
    // const testRef = useRef<string>('')

    useEffect(() => {
        console.log('initial load thing...')

        const terminal = new Terminal({
            convertEol: true,
            cursorBlink: false,
            // fontFamily: 'Fira Code',
            fontSize: 14.5,
            lineHeight: 1.2,
            tabStopWidth: 2,
            // letterSpacing: 0.6,
        })
        const fitAddon = new FitAddon()

        terminal.loadAddon(fitAddon)

        terminal.open(terminalRef.current as HTMLDivElement)
        fitAddon.fit()

        terminal.writeln('Booting WebContainer...')

        bootContainer()
            .then(() => {
                return installDependencies(terminal)
            })
            .then((exitCode) => {
                if (exitCode !== 0) {
                    throw Error('Installation Failed')
                }

                startDevServer(terminal)
                /**
                 * Initially set typescript file to register types
                 * then switch to
                 */

                setContainerReady(true)
            })
            .catch((err) => console.log(err))
    }, [])

    useEffect(() => {
        console.log('TEST | container ready use effect...')
        if (isContainerReady) {
            console.log('TEST | container is ready...')
            const params = new URLSearchParams(window.location.search)

            if (params.has('file') || params.has('test')) {
                console.log('TEST | handle file input...')
                const app =
                    decompressFromEncodedURIComponent(params.get('file') ?? '') ??
                    '// Something went wrong parsing file contents from URL'
                const test =
                    decompressFromEncodedURIComponent(params.get('test') ?? '') ??
                    '// Something went wrong parsing test file contents from URL'
                console.log(app)
                setFiles({
                    'app.js': app,
                    'app.test.js': test,
                })
                setEditorReady(true)
                handleFileInput('app.js', app)
                handleFileInput('app.test.js', test)
            } else {
                setEditorReady(true)
            }
        }
    }, [isContainerReady])

    const bootContainer = async () => {
        webContainerInstance.current = await WebContainer.boot()
        await webContainerInstance.current?.mount(systemFiles)
    }

    const installDependencies = async (terminal: Terminal): Promise<number | undefined> => {
        console.log('Installing dependencies...')

        const installProcess = await webContainerInstance.current?.spawn('npm', ['install'])

        installProcess?.output.pipeTo(
            new WritableStream({
                write(data) {
                    terminal.write(data)
                },
            })
        )

        return installProcess?.exit
    }

    const startDevServer = async (terminal: Terminal) => {
        console.log('Starting dev server...')
        const startProcess = await webContainerInstance.current?.spawn('npm', ['run', 'test'])

        startProcess?.output.pipeTo(
            new WritableStream({
                write(data) {
                    // pipe terminal output but remove keyboard instructions to restart, etc
                    // only doing this because currently not giving access to manually start tests
                    // from terminal
                    terminal.write(data.split('Watch Usage')[0])
                },
            })
        )
    }

    const writeFile = async (fileName: string, content: string) => {
        console.log(`TEST | Writing ${fileName} with ${content}`)
        await webContainerInstance.current?.fs.writeFile(fileName, content)
    }

    const handleFileInput = async (fileName: string, content: string) => {
        writeFile(`src/${fileName}`, content)
    }

    const handleShare = async () => {
        const fileCode = compressToEncodedURIComponent(
            (await webContainerInstance.current?.fs.readFile('src/app.js', 'utf8')) as string
        )
        const testCode = compressToEncodedURIComponent(
            (await webContainerInstance.current?.fs.readFile('src/app.test.js', 'utf8')) as string
        )

        window.history.pushState({}, '', `?file=${fileCode}&test=${testCode}`)
        await navigator.clipboard.writeText(window.location.href)

        setShareText('Copied!')

        setTimeout(() => {
            setShareText('Share')
        }, 1000)
    }

    const handleBeforeMount = (monaco: Monaco) => {
        /**
         * List of tokens
         * https://github.com/microsoft/monaco-editor/issues/1631#issuecomment-555912216
         */

        monaco.editor.defineTheme('cobalt2', {
            base: 'vs-dark',
            inherit: true,
            rules: tokenColors.map((item) => ({
                token: item.scope[0],
                foreground: item.settings.foreground,
                fontStyle: item.settings.fontStyle,
            })),
            colors: colors,
        })
    }

    const handleOnEditorMount = (editor: any, monaco: Monaco) => {
        console.log('mounted...')

        editorRef.current = editor

        monaco?.languages.typescript.javascriptDefaults.setEagerModelSync(true)
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
        })
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.ESNext,
        })

        // THIS WORKS
        monaco.editor.createModel(JestType, 'typescript', monaco.Uri.parse('./types.d.ts'))
    }

    useEffect(() => {
        console.log(`TEST | check and set local storage theme to ${theme}`)
        const currentTheme = localStorage.getItem('theme')
        if (currentTheme) {
            /**
             * Local storage theme exists
             */
            setTheme(currentTheme as any)
        }
    }, [theme])

    return (
        <main className="flex flex-col h-screen overflow-hidden bg-slate-200">
            <nav className="flex flex-row justify-between items-center px-6 py-2 border-b border-gray-400">
                <div className="flex flex-row items-center space-x-4">
                    <h1 className="font-fira text-lg font-bold">Jest Playground</h1>
                    <select
                        className="px-2 py-1 rounded border-gray-300 w-48"
                        onChange={(e) => {
                            localStorage.setItem('theme', e.target.value as any)
                            setTheme(e.target.value as any)
                        }}
                        value={theme}
                    >
                        <option value="cobalt2">Cobalt2</option>
                        <option value="vs-dark">VS Dark</option>
                        <option value="light">Light</option>
                    </select>
                </div>
                <div>
                    <button
                        className="bg-blue-700 px-3 py-1 rounded text-white font-fira hover:bg-blue-800"
                        onClick={() => handleShare()}
                    >
                        {shareText}
                    </button>
                </div>
            </nav>
            <div className="flex flex-row space-x-6 p-6 flex-grow">
                <div className={`w-1/2 flex flex-col ${currentTabTheme.backgroundColor} rounded`}>
                    <div className={`space-x-2 ${currentTabTheme.backgroundColor} rounded-t`}>
                        {Object.entries(FILES).map(([name]) => {
                            if (name === 'types.d.ts') return null
                            return (
                                <button
                                    onClick={() => setFileName(name as any)}
                                    className={`px-4 py-2 ${
                                        fileName === name
                                            ? `${currentTabTheme.activeTextColor} border-b border-b-2 ${currentTabTheme.underlineColor}`
                                            : `${currentTabTheme.textColor} opacity-60 hover:opacity-90`
                                    }`}
                                >
                                    {name}
                                </button>
                            )
                        })}
                    </div>
                    {!isEditorReady && (
                        <div
                            className={`${currentTabTheme.textColor} font-fira h-full flex items-center justify-center`}
                        >
                            Loading...
                        </div>
                    )}
                    {isEditorReady && (
                        <Editor
                            defaultLanguage="typescript"
                            defaultValue={file}
                            onChange={(value) => handleFileInput(fileName, value ?? '')}
                            path={fileName}
                            theme={theme}
                            options={{
                                minimap: {
                                    enabled: false,
                                },
                                fontSize: 14.5,
                                tabSize: 2,
                                lineHeight: 2.1,
                                letterSpacing: 0.6,
                                scrollbar: {
                                    verticalScrollbarSize: 0,
                                },
                                fontLigatures: true,
                                fontFamily: 'Fira Code',
                            }}
                            className={`rounded-b shadow-inner`}
                            onMount={handleOnEditorMount}
                            beforeMount={handleBeforeMount}
                            loading={<div className="text-white font-fira">Loading...</div>}
                        />
                    )}
                </div>
                <div
                    ref={terminalRef}
                    className="w-1/2 h-[100%] bg-black rounded overflow-hidden"
                />
            </div>
        </main>
    )
}

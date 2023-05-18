// import './style.css'
import 'xterm/css/xterm.css'
import { WebContainer } from '@webcontainer/api'
import { files } from './files'
import { useState, useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import Editor, { Monaco } from '@monaco-editor/react'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import JestType from './jest-type'
import { tokenColors } from './cobalt-tokens.json'
import { colors } from './cobalt-colors.json'

const FILES = {
    'app.js': files.src.directory['app.js'].file.contents,
    'app.test.js': files.src.directory['app.test.js'].file.contents,
}

export const App = () => {
    const [fileName, setFileName] = useState<keyof typeof FILES>('app.js')
    const file = FILES[fileName]
    const webContainerInstance = useRef<WebContainer>()
    const terminalRef = useRef<HTMLDivElement>(null)
    const [isContainerReady, setContainerReady] = useState(false)
    const editorRef = useRef(null)
    const appRef = useRef<string>('')
    const testRef = useRef<string>('')

    useEffect(() => {
        console.log('initial load thing...')

        const terminal = new Terminal({
            convertEol: true,
            cursorBlink: false,
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
        if (isContainerReady) {
            const params = new URLSearchParams(window.location.search)

            if (params.has('file') || params.has('test')) {
                handleFileInput(
                    'app.js',
                    decompressFromEncodedURIComponent(params.get('file') ?? '') ??
                        '// Something went wrong parsing file contents from URL'
                )
                handleFileInput(
                    'app.test.js',
                    decompressFromEncodedURIComponent(params.get('test') ?? '') ??
                        '// Something went wrong parsing test file contents from URL'
                )
            }
        }
    }, [isContainerReady])

    const bootContainer = async () => {
        webContainerInstance.current = await WebContainer.boot()
        // setWebContainer(newContainer)
        await webContainerInstance.current?.mount(files)
    }

    const installDependencies = async (terminal: Terminal): Promise<number | undefined> => {
        console.log('Installing dependencies...')

        const installProcess = await webContainerInstance.current?.spawn('npm', ['install'])

        installProcess?.output.pipeTo(
            new WritableStream({
                write(data) {
                    console.log(data)
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
                    //terminal.write(data)
                },
            })
        )
    }

    const writeFile = async (fileName: string, content: string) => {
        await webContainerInstance.current?.fs.writeFile(fileName, content)
    }

    const handleFileInput = async (fileName: string, content: string) => {
        if (fileName === 'app.js') {
            appRef.current = content
        } else {
            testRef.current = content
        }
        writeFile(`src/${fileName}`, content)
    }

    const handleShare = async (file: string, testFile: string) => {
        const fileCode = compressToEncodedURIComponent(file)
        const testCode = compressToEncodedURIComponent(testFile)
        window.history.pushState({}, '', `?file=${fileCode}&test=${testCode}`)
        await navigator.clipboard.writeText(window.location.href)
        window.alert('copied URL to clipboard')
    }

    const handleBeforeMount = (monaco: Monaco) => {
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

    return (
        <main className="overflow-hidden h-screen w-screen">
            <nav className="flex items-center justify-between py-2 px-4">
                <div className="">Jest Playground</div>
                <button
                    onClick={() => handleShare(appRef.current, testRef.current)}
                    className="bg-blue-500 hover:bg-blue-600 rounded px-2 py-1 text-white"
                >
                    Share
                </button>
            </nav>
            <div className="flex flex-row space-x-4">
                <div className="flex flex-col w-1/2 bg-gray-800">
                    <div className="flex flex-row">
                        {Object.entries(FILES).map(([name]) => {
                            if (name === 'types.d.ts') return null
                            return (
                                <button
                                    onClick={() => setFileName(name as any)}
                                    className={`px-3 py-1 ${
                                        fileName === name
                                            ? 'bg-[#193549] text-blue-500 border-b border-blue-400 text-blue-50'
                                            : 'text-blue-400'
                                    }`}
                                >
                                    {name}
                                </button>
                            )
                        })}
                    </div>
                    <div className="bg-[#193549] flex-1">
                        <div className="h-full">
                            <Editor
                                defaultLanguage="typescript"
                                defaultValue={file}
                                onChange={(value) => handleFileInput(fileName, value ?? '')}
                                path={fileName}
                                theme="cobalt2"
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
                                    fontFamily: 'Fira Code, monospace',

                                    // rulers: [1],
                                }}
                                className={'h-100 bg-[#193549]'}
                                onMount={handleOnEditorMount}
                                beforeMount={handleBeforeMount}
                            />
                        </div>
                        {/* <div className={currentTab === INDEX_FILE ? 'h-full' : 'hidden'}>
                            <FileEditor
                                value={fileValue}
                                onChange={(content: any) =>
                                    handleFileInput(INDEX_FILE, content, setFileValue)
                                }
                                isContainerReady={isContainerReady}
                            />
                        </div>
                        <div className={currentTab === TEST_FILE ? 'h-full' : 'hidden'}>
                            <FileEditor
                                value={testValue}
                                onChange={(content: any) =>
                                    handleFileInput(TEST_FILE, content, setTestValue)
                                }
                                isContainerReady={isContainerReady}
                            />
                        </div> */}

                        {/* <Editor
                            language="javascript"
                            value={currentTab === INDEX_FILE ? fileValue : testValue}
                            onChange={(value = '') =>
                                handleFileInput(
                                    currentTab === INDEX_FILE ? INDEX_FILE : TEST_FILE,
                                    value,
                                    currentTab === INDEX_FILE ? setFileValue : setTestValue
                                )
                            }
                            theme="vs-dark"
                            options={{
                                minimap: {
                                    enabled: false,
                                },
                            }}
                        /> */}
                        {/* <Editor
                                language="javascript"
                                value={testValue}
                                onChange={(value = '') =>
                                    handleFileInput(TEST_FILE, value, setTestValue)
                                }
                                theme="vs-dark"
                                options={{
                                    minimap: {
                                        enabled: false,
                                    },
                                }}
                                className={currentTab === TEST_FILE ? 'block' : 'hidden'}
                            /> */}
                    </div>
                </div>
                <div className="w-1/2">
                    <div ref={terminalRef} className="h-screen bg-red-500" />
                </div>
            </div>
        </main>
    )
}

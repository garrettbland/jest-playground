// import './style.css'
import 'xterm/css/xterm.css'
import { WebContainer } from '@webcontainer/api'
import { files } from './files'
import { useState, useEffect, useRef, SetStateAction } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import Editor, { Monaco } from '@monaco-editor/react'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

// let webContainerInstance: WebContainer

const INDEX_FILE = 'app.js'
const TEST_FILE = 'app.test.js'

export const App = () => {
    const [fileValue, setFileValue] = useState(files.src.directory[INDEX_FILE].file.contents)
    const [testValue, setTestValue] = useState(files.src.directory[TEST_FILE].file.contents)
    const [currentTab, setCurrentTab] = useState<'app.js' | 'app.test.js'>('app.js')
    const webContainerInstance = useRef<WebContainer>()
    const terminalRef = useRef<HTMLDivElement>(null)
    const [isContainerReady, setContainerReady] = useState(false)
    const editorRef = useRef(null)

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
                setContainerReady(true)
            })
            .catch((err) => console.log(err))
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.has('file') || params.has('test')) {
            setFileValue(
                decompressFromEncodedURIComponent(params.get('file') ?? '') ??
                    '// Something went wrong parsing file contents from URL'
            )
            setTestValue(
                decompressFromEncodedURIComponent(params.get('test') ?? '') ??
                    '// Something went wrong parsing test file contents from URL'
            )
        }
    }, [])

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

    const handleFileInput = async (
        fileName: string,
        content: string,
        updater: React.Dispatch<SetStateAction<string>>
    ) => {
        updater(content)
        writeFile(`src/${fileName}`, content)
    }

    const handleShare = async (file: string, testFile: string) => {
        const fileCode = compressToEncodedURIComponent(file)
        const testCode = compressToEncodedURIComponent(testFile)
        window.history.pushState({}, '', `?file=${fileCode}&test=${testCode}`)
        await navigator.clipboard.writeText(window.location.href)
        window.alert('copied URL to clipboard')
    }

    const handleEditorWillMount = (editor, monaco: Monaco) => {
        console.log('mounted...')
        monaco?.languages.typescript.javascriptDefaults.setEagerModelSync(true)
        editorRef.current = editor
        // editorRef.current = editor
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true,
            // allowJs: true,
            // module: 2,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            checkJs: true,
            types: ['jest'],
        })
        //         monaco.languages.typescript.javascriptDefaults.addExtraLib(
        //             `
        //               {
        //     "typeAcquisition": {
        //         "include": [
        //             "jest"
        //         ]
        //     }
        // }
        //             `,
        //             'jsconfig.json'
        //         )
    }

    return (
        <main className="overflow-hidden h-screen w-screen">
            <nav className="flex items-center justify-between py-2 px-4">
                <div className="">Jest Playground</div>
                <button
                    onClick={() => handleShare(fileValue, testValue)}
                    className="bg-blue-500 hover:bg-blue-600 rounded px-2 py-1 text-white"
                >
                    Share
                </button>
            </nav>
            <div className="flex flex-row space-x-4">
                <div className="flex flex-col w-1/2">
                    <div className="flex flex-row">
                        <button
                            onClick={() => setCurrentTab(INDEX_FILE)}
                            className={`px-3 py-1 ${
                                currentTab === INDEX_FILE ? 'text-blue-500' : ''
                            }`}
                        >
                            index.ts
                        </button>
                        <button
                            onClick={() => setCurrentTab(TEST_FILE)}
                            className={`px-3 py-1 ${
                                currentTab === TEST_FILE ? 'text-blue-500' : ''
                            }`}
                        >
                            index.test.ts
                        </button>
                    </div>
                    <div className="bg-red-100 flex-1">
                        <div className="h-full">
                            {isContainerReady && (
                                <Editor
                                    defaultLanguage="typescript"
                                    defaultValue={currentTab === INDEX_FILE ? fileValue : testValue}
                                    onChange={(value) =>
                                        handleFileInput(
                                            currentTab === INDEX_FILE ? INDEX_FILE : TEST_FILE,
                                            value ?? '',
                                            currentTab === INDEX_FILE ? setFileValue : setTestValue
                                        )
                                    }
                                    path={currentTab === INDEX_FILE ? INDEX_FILE : TEST_FILE}
                                    theme="vs-dark"
                                    options={{
                                        minimap: {
                                            enabled: false,
                                        },
                                    }}
                                    className="h-100"
                                    onMount={handleEditorWillMount}
                                />
                            )}
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

const FileEditor = ({
    value,
    onChange,
    isContainerReady,
}: {
    value: any
    onChange: any
    isContainerReady: boolean
}) => {
    // const editorRef = useRef(null)

    const handleEditorWillMount = (monaco: Monaco) => {
        console.log('mounted...')
        // editorRef.current = editor
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2016,
            allowNonTsExtensions: true,
            allowJs: true,
            module: 2,
        })
        //monaco.languages.typescript.javascriptDefaults.addExtraLib('@jest/types')
    }

    if (!isContainerReady) {
        return <div>Loading...</div>
    }
    return (
        <Editor
            defaultLanguage="typescript"
            value={value}
            onChange={onChange}
            theme="vs-dark"
            // path={file.name}
            options={{
                minimap: {
                    enabled: false,
                },
            }}
            className="h-100"
            beforeMount={handleEditorWillMount}
        />
    )
}

// const TestEditor = ({ value }) => {
//     return (
//         <Editor
//             language="javascript"
//             value={value}
//             onChange={(value = '') => console.log(value)}
//             theme="vs-dark"
//             options={{
//                 minimap: {
//                     enabled: false,
//                 },
//             }}
//         />
//     )
// }

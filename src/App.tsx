// import './style.css'
import 'xterm/css/xterm.css'
import { WebContainer } from '@webcontainer/api'
import { files } from './files'
import { useState, useEffect, useRef, SetStateAction } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import Editor from '@monaco-editor/react'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

// let webContainerInstance: WebContainer

export const App = () => {
    const [fileValue, setFileValue] = useState(files['index.js'].file.contents)
    const [testValue, setTestValue] = useState(files['index.test.js'].file.contents)
    const webContainerInstance = useRef<WebContainer>()
    const terminalRef = useRef<HTMLDivElement>(null)

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
                },
            })
        )
    }

    const writeFile = async (fileName: string, content: string) => {
        await webContainerInstance.current?.fs.writeFile(fileName, content)
    }

    const handleFileInput = (
        fileName: string,
        content: string,
        updater: React.Dispatch<SetStateAction<string>>
    ) => {
        updater(content)
        writeFile(fileName, content)
    }

    const handleShare = async (file: string, testFile: string) => {
        const fileCode = compressToEncodedURIComponent(file)
        const testCode = compressToEncodedURIComponent(testFile)
        window.history.pushState({}, '', `?file=${fileCode}&test=${testCode}`)
        await navigator.clipboard.writeText(window.location.href)
        window.alert('copied URL to clipboard')
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
                    <Editor
                        language="javascript"
                        value={fileValue}
                        onChange={(value = '') => handleFileInput('index.js', value, setFileValue)}
                        theme="vs-dark"
                        options={{
                            minimap: {
                                enabled: false,
                            },
                        }}
                        className="h-[90%]"
                    />
                    <Editor
                        language="javascript"
                        value={testValue}
                        onChange={(value = '') =>
                            handleFileInput('index.test.js', value, setTestValue)
                        }
                        theme="vs-dark"
                        options={{
                            minimap: {
                                enabled: false,
                            },
                        }}
                        className="-mt-4"
                    />
                </div>
                <div className="w-1/2">
                    <div ref={terminalRef} className="h-screen bg-red-500" />
                </div>
            </div>
        </main>
    )

    return (
        <div className="container">
            <div className="editor">
                {}
                <div style={{ marginBottom: '10px' }}>
                    <Editor
                        height="40vh"
                        language="javascript"
                        value={fileValue}
                        onChange={(value = '') => handleFileInput('index.js', value, setFileValue)}
                        theme="vs-dark"
                        options={{
                            minimap: {
                                enabled: false,
                            },
                        }}
                    />
                </div>
                <Editor
                    height="40vh"
                    language="javascript"
                    value={testValue}
                    onChange={(value = '') => handleFileInput('index.test.js', value, setTestValue)}
                    theme="vs-dark"
                    options={{
                        minimap: {
                            enabled: false,
                        },
                    }}
                />
                <button onClick={() => handleShare(fileValue, testValue)}>Share</button>
            </div>
            <div className="preview">
                <div className="terminal" ref={terminalRef} />
            </div>
        </div>
    )
}

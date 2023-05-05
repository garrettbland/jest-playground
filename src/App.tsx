import './style.css'
import 'xterm/css/xterm.css'
import { WebContainer } from '@webcontainer/api'
import { files } from './files'
import { useState, useEffect, useRef, SetStateAction } from 'react'
import { Terminal } from 'xterm'

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
        })
        terminal.open(terminalRef.current as HTMLDivElement)

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
                    terminal.write(data)
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

    return (
        <div className="container">
            <div className="editor">
                <textarea
                    id="file"
                    value={fileValue}
                    onChange={(e) =>
                        handleFileInput('index.js', e.currentTarget.value, setFileValue)
                    }
                />
                <textarea
                    id="test"
                    value={testValue}
                    onChange={(e) =>
                        handleFileInput('index.test.js', e.currentTarget.value, setTestValue)
                    }
                />
            </div>
            <div className="preview">
                <div className="terminal" ref={terminalRef} />
            </div>
        </div>
    )
}

import * as assert from "assert"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import * as mkdirp from "mkdirp"

import { IFailedTest, Oni, runInProcTest } from "./common"

const LongTimeout = 5000

const CiTests = [
    // Core functionality tests
    "Api.Buffer.AddLayer",
    "Api.Overlays.AddRemoveTest",
    "AutoClosingPairsTest",
    "AutoCompletionTest-CSS",
    "AutoCompletionTest-HTML",
    "AutoCompletionTest-TypeScript",

    "Browser.LocationTest",

    "Configuration.JavaScriptEditorTest",
    "Configuration.TypeScriptEditor.NewConfigurationTest",
    "Configuration.TypeScriptEditor.CompletionTest",

    "Welcome.BufferLayerTest",

    "TabBarSneakTest",
    "initVimPromptNotificationTest",
    "Editor.BuffersCursorTest",
    "Editor.ExternalCommandLineTest",
    "Editor.BufferModifiedState",
    "Editor.OpenFile.PathWithSpacesTest",
    "Editor.ScrollEventTest",
    "Editor.TabModifiedState",
    "Editor.CloseTabWithTabModesTabsTest",
    "Editor.NextPreviousErrorTest",
    "Explorer.LocateBufferTest",
    "MarkdownPreviewTest",
    "PrettierPluginTest",
    "PaintPerformanceTest",
    "QuickOpenTest",
    "StatusBar-Mode",
    "Neovim.InvalidInitVimHandlingTest",
    "Neovim.CallOniCommands",
    "NoInstalledNeovim",
    "Sidebar.ToggleSplitTest",
    "LargePasteTest",

    "Snippets.BasicInsertTest",

    "WindowManager.ErrorBoundary",
    "Workspace.ConfigurationTest",
    // Regression Tests
    "Regression.1251.NoAdditionalProcessesOnStartup",
    "Regression.1296.SettingColorsTest",
    "Regression.1295.UnfocusedWindowTest",
    "Regression.1799.MacroApplicationTest",
    "Regression.2047.VerifyCanvasIsIntegerSize",

    "TextmateHighlighting.DebugScopesTest",
    "TextmateHighlighting.ScopesOnEnterTest",
    "TextmateHighlighting.TokenColorOverrideTest",
    "IndentGuide.BufferLayerTest",
    "ColorHighlight.BufferLayerTest",

    "Theming.LightAndDarkColorsTest",

    // This test occasionally hangs and breaks tests after - trying to move it later...
    "LargeFileTest",
]

const WindowsOnlyTests = [
    // TODO: Stabilize this test on OSX / Linux, too!
    "Regression.1819.AutoReadCheckTimeTest",
]

const OSXOnlyTests = ["OSX.WindowTitleTest"]

// tslint:disable:no-console

import * as Platform from "./../browser/src/Platform"

export interface ITestCase {
    name: string
    testPath: string
    configPath: string
}

const FGRED = "\x1b[31m"
const FGWHITE = "\x1b[37m"
const FGGREEN = "\x1b[32m"
const FGYELLOW = "\x1b[33m"

// tslint:disable-next-line only-arrow-functions
describe("ci tests", function() {
    const tests = Platform.isWindows()
        ? [...CiTests, ...WindowsOnlyTests]
        : Platform.isMac()
            ? [...CiTests, ...OSXOnlyTests]
            : CiTests

    const testFailures: IFailedTest[] = []
    tests.forEach(test => {
        runInProcTest(path.join(__dirname, "ci"), test, 5000, testFailures)
    })

    // After all of the tests are completed display failures
    after(() => {
        if (testFailures.length > 0) {
            console.log("\n", FGRED, "---- FAILED TESTS ----\n")
            testFailures.forEach(failure => {
                console.log(FGYELLOW, "  [FAILED]:", FGWHITE, failure.test)
                console.log(FGWHITE, "     Expected:", FGGREEN, failure.expected)
                console.log(FGWHITE, "     Actual:", FGRED, failure.actual)
                console.log(FGWHITE, "     Path:", failure.path, "\n")
                // TODO: Add line number
            })
            console.log("")
        }
    })
})

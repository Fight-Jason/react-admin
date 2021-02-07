import React, {useCallback, useRef, useEffect, useState} from 'react';
import ReactDOM from 'react-dom';
import config from 'src/commons/config-hoc';
import Element from './Element';
import {scrollElement} from 'src/pages/drag-page/util';
import KeyMap from 'src/pages/drag-page/KeyMap';
import Scale from './Scale';
import DragOver from './drag-over';

const iframeSrcDoc = `
<!DOCTYPE html>
<html lang="en">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=2.0, user-scalable=yes" />
    <body style="scroll-behavior: smooth;">
        <div id="dnd-container" style="display: flex; flex-direction: column; min-height: 100vh"></div>
        <div id="drop-guide-line" style="display: none">
            <span>前</span>
        </div>
        <div id="drop-guide-bg" style="display: none"></div>
    </body>
</html>
`;

export default config({
    side: false,
    connect: state => {
        return {
            pageConfig: state.dragPage.pageConfig,
            activeToolKey: state.dragPage.activeToolKey,
            selectedNodeId: state.dragPage.selectedNodeId,
            activeSideKey: state.dragPage.activeSideKey,
            draggingNode: state.dragPage.draggingNode,
            canvasWidth: state.dragPage.canvasWidth,
            canvasHeight: state.dragPage.canvasHeight,
            rightSideExpended: state.dragPage.rightSideExpended,
            showSide: state.dragPage.showSide,
            rightSideWidth: state.dragPage.rightSideWidth,
            schemaEditorWidth: state.dragPage.schemaEditorWidth,
            componentTreeWidth: state.dragPage.componentTreeWidth,
        };
    },
})(function IframeRender(props) {
    const {
        pageConfig,
        activeToolKey,
        selectedNodeId,
        activeSideKey,
        draggingNode,
        canvasWidth,
        canvasHeight,
        rightSideExpended,
        showSide,
        rightSideWidth,
        schemaEditorWidth,
        componentTreeWidth,
    } = props;
    const dragPageAction = props.action.dragPage;

    const containerRef = useRef(null);
    const iframeRef = useRef(null);
    const iframeRootRef = useRef(null);
    const [scaleElement, setScaleElement] = useState(null);
    const [containerStyle, setContainerStyle] = useState({});

    // 渲染设计页面
    function renderDesignPage() {
        const iframeDocument = iframeRef.current.contentDocument;
        const iframeRootEle = iframeRootRef.current;
        if (!iframeRootEle) return;

        ReactDOM.render(
            <Element
                config={pageConfig}
                pageConfig={pageConfig}
                selectedNodeId={selectedNodeId}
                draggingNode={draggingNode}
                activeSideKey={activeSideKey}
                activeToolKey={activeToolKey}
                dragPageAction={dragPageAction}
                iframeDocument={iframeDocument}
            />,
            iframeRootEle,
        );
    }

    // iframe 加载完成后一些初始化工作
    const handleIframeLoad = useCallback(() => {
        const iframeDocument = iframeRef.current.contentDocument;
        const head = document.head.cloneNode(true);
        iframeDocument.head.remove();
        iframeDocument.documentElement.insertBefore(head, iframeDocument.body);

        iframeDocument.body.style.overflow = 'auto';

        iframeRootRef.current = iframeDocument.getElementById('dnd-container');

        setScaleElement(iframeRootRef.current);

        renderDesignPage();

        dragPageAction.setIFrameDocument(iframeDocument);

    }, [iframeRef.current]);

    // 相关数据改变之后，重新渲染设计页面
    useEffect(() => {
        renderDesignPage();
    }, [
        pageConfig,
        activeToolKey,
        selectedNodeId,
        activeSideKey,
        draggingNode,
        iframeRef.current,
    ]);


    // 选中组件之后，调整左侧组件树滚动
    useEffect(() => {
        const containerEle = iframeRef.current.contentDocument.body;

        if (!containerEle) return;

        // 等待树展开
        setTimeout(() => {
            const element = containerEle.querySelector(`[data-componentid="${selectedNodeId}"]`);

            scrollElement(containerEle, element);
        }, 200);

    }, [selectedNodeId, iframeRef.current]);

    // 设置居中
    useEffect(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        const style = {};
        const {width, height} = rect;

        const iRect = iframeRef.current.getBoundingClientRect();
        const {width: iWidth, height: iHeight} = iRect;

        if (iWidth < width) {
            style.justifyContent = 'center';
        }
        if (iHeight < height) {
            style.alignItems = 'center';
        }

        setContainerStyle(style);

    }, [
        // 所有可能影响到中间部分尺寸变化的操作，都要添加
        rightSideExpended,
        showSide,
        rightSideWidth,
        schemaEditorWidth,
        componentTreeWidth,
        canvasWidth,
        canvasHeight,
        iframeRef.current,
    ]);

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'auto',
            }}
        >
            <div
                ref={containerRef}
                style={{
                    display: 'flex',
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    ...containerStyle,
                }}
            >
                <KeyMap iframe={iframeRef.current}/>
                <iframe
                    id="dnd-iframe"
                    title="dnd-iframe"
                    ref={iframeRef}
                    srcDoc={iframeSrcDoc}
                    onLoad={() => handleIframeLoad()}
                    style={{
                        border: 0,
                        position: 'absolute',
                        width: canvasWidth,
                        height: canvasHeight,
                    }}
                />
            </div>


            <div style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
            }}>
                <Scale element={scaleElement}/>
            </div>
            <DragOver frameDocument={iframeRef.current?.contentDocument}/>
        </div>
    );
});

import React, {useEffect, useState, useRef} from 'react';
import {message, Switch} from 'antd';
import JSON5 from 'json5';
import config from 'src/commons/config-hoc';
import CodeEditor from 'src/pages/drag-page/code-editor';
import {
    findNodeById,
    usePrevious,
    loopIdToFirst,
    deleteUnLinkedIds,
    setNodeId,
    isComponentConfig,
    isFunctionString,
} from '../util';
import {deleteDefaultProps, getComponentConfig} from '../component-config';
import {cloneDeep} from 'lodash';
import './style.less';

const EDIT_TYPE = {
    CURRENT_NODE: 'CURRENT_NODE',
    ALL: 'ALL',
};

export default config({
    connect: state => {
        return {
            pageConfig: state.dragPage.pageConfig,
            selectedNode: state.dragPage.selectedNode,
            activeSideKey: state.dragPage.activeSideKey,
            sideWidth: state.dragPage.sideWidth,
        };
    },
})(function SchemaEditor(props) {
    const {
        pageConfig,
        selectedNode,
        activeSideKey,
        sideWidth,
        action: {dragPage: dragPageAction},
    } = props;

    const [visible, setVisible] = useState(false);
    const [editType, setEditType] = useState(EDIT_TYPE.CURRENT_NODE);
    const [code, setCode] = useState('');
    const saveRef = useRef(false);

    const prevActiveSideKey = usePrevious(activeSideKey);
    useEffect(() => {
        const key = 'schemaEditor';
        const visible = (!prevActiveSideKey && activeSideKey === key)
            || (prevActiveSideKey !== key && activeSideKey === key);

        setVisible(visible);
    }, [activeSideKey]);

    function findIdPosition(value) {
        const nodeConfig = codeToObject(value);
        if (nodeConfig instanceof Error) return;

        const ids = [];
        const loopGetId = node => {
            if (node.id) ids.push(node.id);

            if (node.children?.length) {
                node.children.forEach(item => loopGetId(item));
            }

            // props中有可能也有节点
            Object.values(node.props || {})
                .forEach(value => {
                    if (isComponentConfig(value)) {
                        loopGetId(value);
                    }
                });

            // wrapper中有节点
            if (node?.wrapper?.length) {
                node.wrapper.forEach(item => loopGetId(item));
            }
        };

        loopGetId(nodeConfig);

        // 查询所有id在value中出现的位置
        const idPosition = [];

        const values = value.split('\n');
        let n = 0;
        values.forEach((val, index) => {
            if (val.includes('/*')) n++;
            if (val.includes('*/')) n--;
            // 多行注释中
            if (n > 0) return;
            // 单行注释中
            if (val.trim().startsWith('//')) return;

            if (val.trim().startsWith('id')) {
                const id = ids.find(id => val.includes(id));
                if (id) {
                    idPosition.push({id, index});
                }
            }
        });

        return idPosition;

    }

    function codeToObject(code) {
        if (!code) return null;

        const val = code.replace('export', '').replace('default', '');
        try {
            let obj;
            // eslint-disable-next-line
            eval(`obj = ${val}`);

            if (typeof obj !== 'object' || Array.isArray(obj)) {
                return Error('语法错误，请修改后保存！');
            }

            const loopComponentName = node => {
                if (!node.componentName) return false;

                if (node?.children?.length) {
                    for (let item of node.children) {
                        const result = loopComponentName(item);
                        if (result === false) return result;
                    }
                }

                return true;
            };

            if (!loopComponentName(obj)) return Error('缺少必填字段「componentName」!');

            // 函数转字符串
            const loopFunction = node => {
                Object.entries(node)
                    .forEach(([key, value]) => {
                        if (typeof value === 'function') {
                            node[key] = value.toString();
                        }
                        if (Array.isArray(value)) {
                            value.forEach(item => loopFunction(item));
                        }
                        if (typeof value === 'object' && value && !Array.isArray(value)) {
                            loopFunction(value);
                        }
                    });
            };

            loopFunction(obj);

            return obj;
        } catch (e) {
            console.error(e);
            return Error('语法错误，请修改后保存！');
        }
    }

    function handleSave(value, errors) {
        if (errors?.length) return message.error('语法错误，请修改后保存！');

        const nodeConfig = codeToObject(value);
        if (nodeConfig instanceof Error) return message.error(nodeConfig.message);

        const idPosition = findIdPosition(value);
        const ids = [];
        const repeatIds = [];
        idPosition.forEach(item => {
            if (!ids.some(it => it.id === item.id)) {
                ids.push(item);
            } else {
                repeatIds.push(item);
            }
        });

        if (repeatIds?.length) {
            const messages = [];
            repeatIds.forEach(item => {
                const prevId = ids.find(it => it.id === item.id);
                messages.push(`第 ${prevId.index + 1} 行 与 第 ${item.index + 1} 行「id」重复！`);
            });
            messages.push('请修改后保存！');
            const msg = messages.map(item => <div>{item}</div>);
            return message.error(msg);
        }

        let nextPageConfig;

        // 编辑单独节点
        if (editType !== EDIT_TYPE.ALL) {
            const componentId = nodeConfig?.id;
            const node = findNodeById(pageConfig, componentId);

            if (!node) return message.error('节点无法对应，您是否修改了根节点的id?');

            // 删除所有数据，保留引用
            Object.keys(node).forEach(key => {
                Reflect.deleteProperty(node, key);
            });
            // 赋值
            Object.entries(nodeConfig).forEach(([key, value]) => {
                node[key] = value;
            });
            nextPageConfig = pageConfig;
        } else {
            nextPageConfig = nodeConfig;
        }

        // id 不存在，则设置新的id
        setNodeId(nextPageConfig);

        saveRef.current = true;

        console.log(nextPageConfig);
        dragPageAction.setPageConfig({...nextPageConfig});
        // 右侧样式、属性面板没有关联pageConfig，需要刷新同步一下
        dragPageAction.refreshProps();

        const nextSelectedNode = findNodeById(nextPageConfig, selectedNode?.id);
        dragPageAction.setSelectedNodeId(nextSelectedNode?.id);

        message.success('保存成功！');
    }

    function handleClose() {
        dragPageAction.setActiveSideKey(null);
    }

    useEffect(() => {
        if (!visible) return;
        // 由于保存触发的，不做任何处理
        if (saveRef.current) {
            saveRef.current = false;
            return;
        }

        const allNodes = cloneDeep(pageConfig);
        const node = findNodeById(allNodes, selectedNode?.id);

        // 清除非关联id， 当前选中节点id不能删
        deleteUnLinkedIds(allNodes, [node?.id]);

        let editNode;
        if (editType === EDIT_TYPE.CURRENT_NODE) editNode = node;
        if (editType === EDIT_TYPE.ALL) editNode = allNodes;

        if (!editNode) {
            setEditType(EDIT_TYPE.ALL);
            return;
        }

        // 清除默认值
        deleteDefaultProps(editNode);

        // id 属性调整到首位
        loopIdToFirst(editNode);


        const FUNCTION_HOLDER = '___function___';

        const loop = node => {
            const nodeConfig = getComponentConfig(node.componentName);
            const beforeSchemaEdit = nodeConfig?.hooks?.beforeSchemaEdit;
            beforeSchemaEdit && beforeSchemaEdit({node});
            if (node.props) {
                Object.entries(node.props)
                    .forEach(([key, value]) => {
                        if (isFunctionString(value)) {
                            let fn;
                            // eslint-disable-next-line
                            eval(`fn = ${value}`);
                            if (typeof fn === 'function') {
                                node.props[key] = `${FUNCTION_HOLDER}${value}${FUNCTION_HOLDER}`;
                            }
                        }
                    });
            }

            if (node.children?.length) {
                node.children.forEach(item => loop(item));
            }

            // props中有可能也有节点
            Object.values(node.props || {})
                .forEach(value => {
                    if (isComponentConfig(value)) {
                        loop(value);
                    }
                });

            // wrapper中有节点
            if (node?.wrapper?.length) {
                node.wrapper.forEach(item => loop(item));
            }
        };

        loop(editNode);

        let nextCode = `export default ${JSON5.stringify(editNode, null, 2)}`;
        nextCode = nextCode.replace(RegExp(`'${FUNCTION_HOLDER}`, 'g'), '');
        nextCode = nextCode.replace(RegExp(`${FUNCTION_HOLDER}'`, 'g'), '');
        nextCode = nextCode.replace(/\\n/g, '\n');

        setCode(nextCode);
    }, [visible, editType, selectedNode, pageConfig]);

    if (!visible) return null;

    return (
        <div styleName="root" id="schemaEditor">
            <CodeEditor
                editorWidth={sideWidth}
                title={(
                    <div styleName="title">
                        <span style={{marginRight: 8}}>Schema 源码开发</span>
                        <Switch
                            checkedChildren="选中"
                            unCheckedChildren="全部"
                            checked={editType === EDIT_TYPE.CURRENT_NODE}
                            onChange={checked => setEditType(checked ? EDIT_TYPE.CURRENT_NODE : EDIT_TYPE.ALL)}
                        />
                    </div>
                )}
                value={code}
                onSave={handleSave}
                onClose={handleClose}
            />
        </div>
    );
});

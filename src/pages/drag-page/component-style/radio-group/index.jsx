import React from 'react';
import PropTypes from 'prop-types';
import {Radio, Tooltip} from 'antd';
import './style.less';

const RadioGroup = props => {
    const {options, allowClear, onChange, placement, getPopupContainer, ...others} = props;

    function renderOptions(options) {
        return options.map((item, index) => {
            const {
                value,
                label,
                icon,
                tip,
                title: ti,
            } = item;

            const isLast = index === options.length - 1;

            let title = tip || label;
            const la = icon || label;

            function handleClick() {
                if (!allowClear) return;
                // 再次点击选中清空
                setTimeout(() => {
                    if (props.value === value) {
                        onChange && onChange(undefined);
                    }
                });
            }

            const tooltipTitle = ti || `${title} ${value}`;

            let pl = placement;
            if (!pl) pl = isLast ? 'topRight' : 'top';

            let labelNode = (
                <Tooltip
                    placement={pl}
                    title={tooltipTitle}
                    mouseLeaveDelay={0}
                    getPopupContainer={getPopupContainer}
                >
                    <div style={{userSelect: 'none'}} onClick={handleClick}>
                        {la}
                    </div>
                </Tooltip>
            );

            return {
                value,
                label: labelNode,
            };
        });
    }

    return (
        <Radio.Group
            styleName="root"
            options={renderOptions(options)}
            optionType="button"
            buttonStyle="solid"
            onChange={onChange}
            {...others}
        />
    );
};

RadioGroup.propTypes = {
    options: PropTypes.array,
    allowClear: PropTypes.bool,
    placement: PropTypes.string,
};
RadioGroup.defaultProps = {
    allowClear: true,
};

export default RadioGroup;

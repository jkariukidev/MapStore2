/*
 * Copyright 2019, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

import React from 'react';

import PropTypes from 'prop-types';

import {
    FormGroup,
    ControlLabel,
    MenuItem,
    DropdownButton as DropdownButtonRB,
    Glyphicon as GlyphiconRB
} from 'react-bootstrap';

import Select from 'react-select';
import tooltip from '../../misc/enhancers/tooltip';
const Glyphicon = tooltip(GlyphiconRB);
const DropdownButton = tooltip(DropdownButtonRB);
import { head, isNaN, get, isEmpty } from 'lodash';
import { getMessageById } from '../../../utils/LocaleUtils';
import Toolbar from '../../misc/toolbar/Toolbar';
import draggableContainer from '../../misc/enhancers/draggableContainer';
import Message from '../../I18N/Message';
import { validateCoords, coordToArray } from '../../../plugins/Annotations/utils/AnnotationsUtils';
import CoordinatesRow from '../../misc/coordinateeditors/CoordinatesRow';
import MeasureEditor from './MeasureEditor';

/**
 * Geometry editor for annotation Features.
 * @memberof components.annotations
 * @class
 * @prop {object[]} components the data used as value in the CoordinatesRow
 * @prop {object} measureOptions options for the measure input
 * @prop {function} onSetInvalidSelected if the form becomes invalid, this will be triggered
 * @prop {function} onChange triggered on every coordinate change
 * @prop {function} onChangeText triggered every text change
 * @prop {function} onHighlightPoint triggered on mouse enter and leave and if polygons or linestring editor is opened
 * @prop {function} onChangeRadius triggered every radius change
 * @prop {function} onChangeFormat triggered every format change
 * @prop {boolean} isMouseEnterEnabled Flag used to run actions on mouseEnter the coord row
 * @prop {boolean} isMouseLeaveEnabled Flag used to run actions on mouseLeave the coord row
 * @prop {string} format decimal or aeronautical degree for coordinates
 * @prop {object} componentsValidation it contains parameters for validation of the form based on the types
 * @prop {object} transitionProps properties of the transition for drag component
 * @prop {object} properties of the GeoJSON feature being edited
 * @prop {string} type of the feature (Polygon, LineString, Point, Circle, Text)
 * @prop {string} mapProjection crs of the map
 * @prop {string} isDraggable tells if the coordinate row is draggable
 * @prop {string} renderer flag to determine the rendering component
 *
*/
class CoordinatesEditor extends React.Component {
    static propTypes = {
        components: PropTypes.array,
        measureOptions: PropTypes.object,
        onSetInvalidSelected: PropTypes.func,
        onChange: PropTypes.func,
        onChangeRadius: PropTypes.func,
        onHighlightPoint: PropTypes.func,
        onChangeText: PropTypes.func,
        onChangeFormat: PropTypes.func,
        onChangeCurrentFeature: PropTypes.func,
        format: PropTypes.string,
        aeronauticalOptions: PropTypes.object,
        componentsValidation: PropTypes.object,
        transitionProps: PropTypes.object,
        properties: PropTypes.object,
        mapProjection: PropTypes.string,
        features: PropTypes.array,
        currentFeature: PropTypes.number,
        showFeatureSelector: PropTypes.bool,
        type: PropTypes.string,
        isDraggable: PropTypes.bool,
        isMouseEnterEnabled: PropTypes.bool,
        isMouseLeaveEnabled: PropTypes.bool,
        showLengthAndBearingLabel: PropTypes.bool,
        renderer: PropTypes.string,
        style: PropTypes.object,
        onValidateFeature: PropTypes.func,
        enableHeightField: PropTypes.bool
    };

    static contextTypes = {
        messages: PropTypes.object
    };

    static defaultProps = {
        components: [],
        measureOptions: {},
        onChange: () => {},
        onChangeRadius: () => {},
        onHighlightPoint: () => {},
        onChangeFormat: () => {},
        onChangeText: () => {},
        onChangeCurrentFeature: () => {},
        onSetInvalidSelected: () => {},
        onValidateFeature: () => {},
        componentsValidation: {
            "Bearing": {min: 2, max: 2, add: true, remove: true, validation: "validateCoordinates", notValid: "annotations.editor.notValidPolyline"},
            "Polygon": {min: 3, add: true, remove: true, validation: "validateCoordinates", notValid: "annotations.editor.notValidPolyline"},
            "LineString": {min: 2, add: true, remove: true, validation: "validateCoordinates", notValid: "annotations.editor.notValidPolyline"},
            "MultiPoint": {min: 2, add: true, remove: true, validation: "validateCoordinates", notValid: "annotations.editor.notValidPolyline"},
            "Point": {min: 1, max: 1, add: true, remove: false, validation: "validateCoordinates", notValid: "annotations.editor.notValidMarker"},
            "Circle": {min: 1, max: 1, add: true, remove: false, validation: "validateCircle", notValid: "annotations.editor.notValidCircle"},
            "Text": {min: 1, max: 1, add: true, remove: false, validation: "validateText", notValid: "annotations.editor.notValidText"}
        },
        transitionProps: {
            transitionName: "switch-panel-transition",
            transitionEnterTimeout: 300,
            transitionLeaveTimeout: 300
        },
        features: [],
        isDraggable: true,
        isMouseEnterEnabled: false,
        isMouseLeaveEnabled: false,
        properties: {},
        type: "Point",
        style: {display: 'flex', flexDirection: 'column', flex: 1},
        enableHeightField: false
    };

    getValidationStateRadius = (radius) => {
        const r = parseFloat(radius);
        if (isNaN(r)) {
            return "error";
        }
        return null; // "success"
    }

    renderCircle() {
        return (<div className="ms-coordinates-editor-radius" style={{flex: 1, overflowY: 'auto', padding: "0 10px"}}>
            <div>
                <FormGroup validationState={this.getValidationStateRadius(this.props.properties.radius)}>
                    <ControlLabel><Message msgId="annotations.editor.radius"/></ControlLabel>
                    <MeasureEditor
                        placeholder="radius"
                        {...this.props.measureOptions}
                        value={this.props.properties.radius}
                        projection={this.props.mapProjection}
                        name="radius"
                        onChange={(radius, uom) => {
                            this.props.onValidateFeature();
                            if (this.isValid(this.props.components, radius )) {
                                this.props.onChangeRadius(parseFloat(radius), this.props.components.map(coordToArray), uom);
                            } else if (radius !== "") {
                                this.props.onChangeRadius(parseFloat(radius), [], uom);
                            } else {
                                this.props.onChangeRadius(null, this.props.components.map(coordToArray), uom);
                                this.props.onSetInvalidSelected("radius", this.props.components.map(coordToArray));
                            }
                        }}
                        step={1}
                        type="number"/>
                </FormGroup>
            </div>
        </div>);
    }

    renderLabelTexts = (index, textValues) =>{
        const {textLabels, featurePropValue} = textValues;
        if (this.props.type === "Polygon") {
            return !isEmpty(textLabels) && textLabels[index].text;
        }
        return index !== 0 ?
            !isEmpty(textLabels) ? textLabels[index - 1].text :
                !isEmpty(featurePropValue) && featurePropValue[0].formattedValue :
            null;
    }

    render() {
        const feature = this.props.features[this.props.currentFeature || 0];
        const textLabels = get(feature, "geometry.textLabels", []);
        const featurePropValue = get(feature, "properties.values", []);
        const {componentsValidation, type} = this.props;
        const actualComponents = [...this.props.components];
        const actualValidComponents = actualComponents.filter(validateCoords);
        const allValidComponents = actualValidComponents.length === actualComponents.length;
        const validationCompleteButton = this[componentsValidation[type].validation]() && allValidComponents;
        const formats = [{
            value: 'decimal',
            text: <Message msgId="annotations.editor.decimal"/>
        }, {
            value: 'aeronautical',
            text: <Message msgId="annotations.editor.aeronautical"/>
        }];

        const buttons = [
            {
                glyph: validationCompleteButton ? 'ok-sign text-success' : 'exclamation-mark text-danger',
                tooltipId: validationCompleteButton ? 'annotations.editor.valid' : componentsValidation[type].notValid,
                visible: true,
                onClick: () => {}
            }, {
                Element: () => (
                    <DropdownButton
                        noCaret
                        title={<Glyphicon glyph="cog"/>}
                        pullRight
                        className="square-button-md no-border"
                        tooltip="Format">
                        {formats.map(({text, value}) => <MenuItem
                            active={this.props.format === value}
                            key={value}
                            onClick={() => this.props.onChangeFormat(value)}>{text}</MenuItem>)}
                    </DropdownButton>
                )
            },
            {
                glyph: 'plus',
                tooltipId: 'annotations.editor.add',
                disabled: type !== 'Bearing' ? this.props.properties.disabled : false,
                visible: componentsValidation[type].add && componentsValidation[type].max ? this.props.components.length !== componentsValidation[type].max : true,
                onClick: () => {
                    let tempComps = [...this.props.components];
                    tempComps = tempComps.concat([{lat: "", lon: ""}]);
                    this.props.onChange(tempComps, this.props.properties.radius, this.props.properties.valueText, this.props.mapProjection);
                }
            }
        ];
        return (
            <div className="coordinates-editor" style={this.props.style}>
                <div className={"measure-feature-selector"}>
                    <div>
                        {this.props.showFeatureSelector ? <Select
                            value={this.props.currentFeature}
                            disabled={this.props.properties.disabled}
                            options={[
                                ...this.props.features.map((f, i) => {
                                    const values = get(f, 'properties.values', []);
                                    const geomType = (values[0] || {}).type === 'bearing' ? 'Bearing' : f.geometry.type;
                                    if (geomType !== this.props.type) {
                                        return null;
                                    }
                                    const measureName = geomType === 'LineString' ? 'Length' : geomType === 'Bearing' ? 'Bearing' : 'Area';
                                    const valueLabel = values.length > 0 ?
                                        `${measureName} ${values[0].formattedValue}` :
                                        '';
                                    const secondValueLabel =
                                        values.length > 1 && geomType === 'Polygon' ?
                                            `, Perimeter: ${values[1].formattedValue}` :
                                            '';
                                    return {label: `${geomType} (${valueLabel}${secondValueLabel})`, value: i};
                                }), {
                                    label: getMessageById(this.context.messages, 'annotations.editor.newFeature'),
                                    value: this.props.features.length
                                }
                            ].filter(f => !!f)}
                            onChange={e => this.props.onChangeCurrentFeature(e?.value)}/> : null}
                    </div>
                    <div>
                        <Toolbar
                            btnGroupProps={{ className: 'pull-right' }}
                            btnDefaultProps={{ className: 'square-button-md no-border'}}
                            buttons={buttons}/>
                    </div>
                </div>
                {this.props.type === "Circle" && this.renderCircle()}
                {
                    this.props.type === "Circle" && <div style={{flex: 1, overflowY: 'auto', paddingLeft: 10, marginTop: 10}}>
                        <div>
                            <ControlLabel><Message msgId={"annotations.editor.center"}/></ControlLabel>
                        </div>
                    </div>
                }
                <div className={`coordinates-row-container coordinates-row-type-${type}`}>
                    {this.props.components.map((component, idx) =><>
                        {this.props.showLengthAndBearingLabel && <div className={'label-texts'}>
                            <span>
                                {this.renderLabelTexts(idx, {textLabels, featurePropValue})}
                            </span>
                        </div>
                        }
                        <CoordinatesRow
                            format={this.props.format}
                            aeronauticalOptions={this.props.aeronauticalOptions}
                            sortId={idx}
                            key={idx + " key"}
                            enableHeightField={this.props.enableHeightField}
                            disabled={this.props.properties.disabled && validateCoords(component)}
                            renderer={this.props.renderer}
                            isDraggable={this.props.isDraggable}
                            isDraggableEnabled={this.props.isDraggable && this[componentsValidation[type].validation]() && !this.props.properties.disabled}
                            showDraggable={this.props.isDraggable && !(this.props.type === "Point" || this.props.type === "Text" || this.props.type === "Circle")}
                            formatVisible={false}
                            removeVisible={componentsValidation[type].remove}
                            removeEnabled={this[componentsValidation[type].validation](this.props.components, componentsValidation[type].remove, idx)}
                            onSubmit={this.change}
                            onMouseEnter={(val) => {
                                if (this.props.isMouseEnterEnabled || this.props.type === "LineString" || this.props.type === "Polygon" || this.props.type === "MultiPoint") {
                                    this.props.onHighlightPoint(val);
                                }
                            }}
                            onMouseLeave={() => {
                                if (this.props.isMouseLeaveEnabled || this.props.type === "LineString" || this.props.type === "Polygon" || this.props.type === "MultiPoint") {
                                    this.props.onHighlightPoint(null);
                                }
                            }}
                            onSort={(targetId, currentId) => {
                                const components = this.props.components.reduce((allCmp, cmp, id) => {
                                    if (targetId === id) {
                                        return targetId > currentId ?
                                            [...allCmp, {...cmp}, head(this.props.components.filter((cm, i) => i === currentId))]
                                            :
                                            [...allCmp, head(this.props.components.filter((cm, i) => i === currentId)), {...cmp}];
                                    }
                                    if (currentId === id) {
                                        return [...allCmp];
                                    }
                                    return [...allCmp, {...cmp}];
                                }, []).filter(val => val);

                                if (this.isValid(components)) {
                                    this.props.onChange(components);
                                } else if (this.props.properties.isValidFeature) {
                                    this.props.onSetInvalidSelected("coords", this.props.components.map(coordToArray));
                                }
                            }}
                            idx={idx}
                            component={component}
                            onRemove={() => {
                                const components = this.props.components.filter((cmp, i) => i !== idx);
                                if (this.isValid(components)) {
                                    if (this.props.isMouseEnterEnabled || this.props.type === "LineString" && idx !== components.length || this.props.type === "Polygon") {
                                        this.props.onHighlightPoint(components[idx]);
                                    } else {
                                        this.props.onHighlightPoint(null);
                                    }
                                    this.props.onChange(components);
                                } else if (this.props.properties.isValidFeature) {
                                    this.props.onSetInvalidSelected("coords", this.props.components.map(coordToArray));
                                }
                            }}
                            onValidateFeature={this.props.onValidateFeature}/>
                    </>
                    )}
                </div>
                {(!this.props.components || this.props.components.length === 0) &&
                    <div className="text-center" style={{padding: 15, paddingBottom: 30}}>
                        <i><Message msgId="annotations.editor.addByClick"/></i>
                    </div>}
            </div>
        );
    }
    validateCoordinates = (components = this.props.components, remove = false, idx) => {
        if (components && components.length) {
            const validComponents = components.filter(validateCoords);

            if (remove) {
                return validComponents.length > this.props.componentsValidation[this.props.type].min ||
                // if there are at least the min number of valid points, then you can delete the other invalid ones
                validComponents.length >= this.props.componentsValidation[this.props.type].min && !validateCoords(components[idx]);
            }
            return validComponents.length >= this.props.componentsValidation[this.props.type].min;
        }
        return false;
    }
    validateCircle = (components = this.props.components, remove, radius = this.props.properties.radius) => {
        if (components && components.length) {
            const cmp = head(components);
            return !isNaN(parseFloat(radius)) && validateCoords(cmp);
        }
        return false;
    }
    validateText = (components = this.props.components, remove, valueText = this.props.properties.valueText) => {
        if (components && components.length) {
            const cmp = head(components);
            return !!valueText && validateCoords(cmp);
        }
        return false;
    }
    isValid = (components = this.props.components, val) => {
        return this[this.props.componentsValidation[this.props.type].validation](components, false, val);
    }
    addCoordPolygon = (components) => {
        if (this.props.type === "Polygon") {
            const validComponents = components.filter(validateCoords);
            const coordinates = this.props.features[this.props.currentFeature]?.geometry?.coordinates?.[0] || [];
            const invalidCoordinateIndex = coordinates !== undefined ? coordinates.findIndex(c=> !validateCoords({lon: c[0], lat: c[1], ...(c[2] !== undefined && { height: c[2] }) })) : -1;
            return components.concat([validComponents.length && invalidCoordinateIndex !== 0 ? validComponents[0] : {lat: "", lon: ""}]);
        }
        return components;
    }
    change = (id, value) => {
        let tempComps = this.props.components;
        const lat = isNaN(parseFloat(value.lat)) ? "" : parseFloat(value.lat);
        const lon = isNaN(parseFloat(value.lon)) ? "" : parseFloat(value.lon);
        const height = value.height !== undefined ? isNaN(parseFloat(value.height)) ? "" : parseFloat(value.height) : undefined;
        tempComps[id] = {lat, lon, ...(height !== undefined && { height })};
        let validComponents = this.addCoordPolygon(tempComps);
        this.props.onChange(validComponents, this.props.properties.radius, this.props.properties.valueText, this.props.mapProjection);
        if (!this.isValid(tempComps)) {
            if (this.props.isMouseLeaveEnabled || this.props.type === "LineString" || this.props.type === "Polygon") {
                this.props.onHighlightPoint(null);
            }
            this.props.onSetInvalidSelected("coords", tempComps.map(coordToArray));
        } else {
            if (this.props.isMouseEnterEnabled || this.props.type === "LineString" || this.props.type === "Polygon") {
                this.props.onHighlightPoint(tempComps[id]);
            }
        }
    }
}

export default draggableContainer(CoordinatesEditor);

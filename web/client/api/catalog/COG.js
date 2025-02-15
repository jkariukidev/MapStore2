/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';
import { fromUrl } from 'geotiff';

import { isValidURL } from '../../utils/URLUtils';
import ConfigUtils from '../../utils/ConfigUtils';
import { isProjectionAvailable } from '../../utils/ProjectionUtils';

export const COG_LAYER_TYPE = 'cog';
const searchAndPaginate = (layers, startPosition, maxRecords, text) => {
    const filteredLayers = layers
        .filter(({ title = "" } = {}) => !text
            || title.toLowerCase().indexOf(text.toLowerCase()) !== -1
        );
    const records = filteredLayers
        .filter((layer, index) => index >= startPosition - 1 && index < startPosition - 1 + maxRecords);
    return {
        numberOfRecordsMatched: filteredLayers.length,
        numberOfRecordsReturned: records.length,
        nextRecord: startPosition + Math.min(maxRecords, filteredLayers.length) + 1,
        records
    };
};
/**
 * Get projection code from geokeys
 * @param {Object} image
 * @returns {string} projection code
 */
export const getProjectionFromGeoKeys = (image) => {
    const geoKeys = image.geoKeys;
    if (!geoKeys) {
        return null;
    }

    if (
        geoKeys.ProjectedCSTypeGeoKey &&
        geoKeys.ProjectedCSTypeGeoKey !== 32767
    ) {
        return "EPSG:" + geoKeys.ProjectedCSTypeGeoKey;
    }

    if (
        geoKeys.GeographicTypeGeoKey &&
        geoKeys.GeographicTypeGeoKey !== 32767
    ) {
        return "EPSG:" + geoKeys.GeographicTypeGeoKey;
    }

    return null;
};
let capabilitiesCache = {};

export const getRecords = (_url, startPosition, maxRecords, text, info = {}) => {
    const service = get(info, 'options.service');
    let layers = [];
    if (service.records) {
        // each record/url corresponds to a layer
        layers = service.records?.map((record) => {
            const url = record.url;
            let layer = {
                ...service,
                title: record.title,
                type: COG_LAYER_TYPE,
                sources: [{url}],
                options: service.options || {}
            };
            if (service.fetchMetadata) {
                const cached = capabilitiesCache[url];
                if (cached && new Date().getTime() < cached.timestamp + (ConfigUtils.getConfigProp('cacheExpire') || 60) * 1000) {
                    return {...cached.data};
                }
                return fromUrl(url)
                    .then(geotiff => geotiff.getImage())
                    .then(image => {
                        const crs = getProjectionFromGeoKeys(image);
                        const extent = image.getBoundingBox();
                        const isProjectionDefined = isProjectionAvailable(crs);
                        layer = {
                            ...layer,
                            // skip adding bbox when geokeys or extent is empty
                            ...(!isEmpty(extent) && !isEmpty(crs) && isProjectionDefined && {
                                bbox: {
                                    crs,
                                    bounds: {
                                        minx: extent[0],
                                        miny: extent[1],
                                        maxx: extent[2],
                                        maxy: extent[3]
                                    }
                                }
                            })
                        };
                        capabilitiesCache[url] = {
                            timestamp: new Date().getTime(),
                            data: {...layer}
                        };
                        return layer;
                    }).catch(() => ({...layer}));
            }
            return Promise.resolve(layer);
        });
    }
    return Promise.all([...layers]).then((_layers) => {
        return searchAndPaginate(_layers, startPosition, maxRecords, text);
    });
};

export const textSearch = (url, startPosition, maxRecords, text, info = {}) => {
    return getRecords(url, startPosition, maxRecords, text, info);
};

const validateCog = (service) => {
    const isValid = service.records?.every(record => isValidURL(record?.url));
    if (service.title && isValid) {
        return Observable.of(service);
    }
    const error = new Error("catalog.config.notValidURLTemplate");
    // insert valid URL;
    throw error;
};
export const validate = service => {
    return validateCog(service);
};
export const testService = service => {
    return Observable.of(service);
};

export const getCatalogRecords = (data) => {
    if (data && data.records) {
        return data.records.map(record => {
            return {
                ...record,
                serviceType: COG_LAYER_TYPE,
                isValid: record.sources?.every(source => isValidURL(source.url)),
                title: record.title || record.provider,
                sources: record.sources,
                options: record.options,
                references: []
            };
        });
    }
    return null;
};

/**
 * Converts a record into a layer
 */
export const cogToLayer = (record) => {
    return {
        ...record,
        type: COG_LAYER_TYPE,
        visibility: true,
        sources: record.sources,
        title: record.title,
        options: record.options,
        name: record.title
    };
};

const recordToLayer = (record, options) => {
    return cogToLayer(record, options);
};

export const getLayerFromRecord = (record, options, asPromise) => {
    if (asPromise) {
        return Promise.resolve(recordToLayer(record, options));
    }
    return recordToLayer(record, options);
};

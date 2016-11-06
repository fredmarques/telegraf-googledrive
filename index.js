const google = require('googleapis');
const extend = require('xtend');

const drive = google.drive({
    version: 'v3'
});

/* list all files from Google Drive, given a unique ID.
 * @rootId: folder's id where google will list all files within
 * @fields: files metada data to be retrive
 * @auth: authtenctation object as decribed on Google API / Drive / Oauth Cliente
 * @callback: method that will handle all files listed (if no errors)by Google API
 */
const getFolder = (rootId, fields, auth, callback) => {
    drive.files.list({
        auth
        , ...fields
        , q: `'${rootId}' in parents`
    }, (err, res) => callback(err, res, rootId));
};

/* callback to handle Google Drive files (or an error).
 * in this callback method we just add to ctx.state
 * all files listed from google drive.
 */
const callback = (ctx, next) => (err, res, rootId) => {
    if (err) {
        console.log(err);
        return next();
    }

    const nextState = extend(ctx.state,
        { folders: {
            [rootId]: res.files
        } });
    ctx.state = nextState; //eslint-disable-line
    return next();
};

/* Create a middleware for Telegraf
 * @params: fields to be listed for each file, folder id (rootId) and a authentication
 * as decribed on Google API / Drive.
 * ctx and next are the parameters from Telegraf. For more refer to Telegraf docs
 * sessoin about middleware.
 */
const createMiddleware = params => (ctx, next) => {
    const { fields, rootId, auth } = params;

    return getFolder(rootId, fields, auth, callback(ctx, next));
};
module.exports = createMiddleware;


const google = require('googleapis');
const extend = require('xtend');
const fs = require('fs');

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

const getReplyFile = (fileId, fileType, path, auth, callback) => {
    const dest = fs.createWriteStream(`${path}/${fileId}`);
    drive.files.get({
        fileId
        , auth
        , alt: 'media'
    })
    .on('end', () => {
        callback(fileType, `${path}/${fileId}`);
    })
    .on('error', err => {
        console.log('Error during download', err);
    })
    .pipe(dest);
};

const getDescription = (fileId, path, auth, callback) => {
    const dest = fs.createWriteStream(`${path}/${fileId}`);
    return drive.files.get({
        fileId
        , auth
        , alt: 'media'
    })
    .on('end', () => {
        callback(`${path}/${fileId}`);
    })
    .on('error', err => {
        console.log('Error during getDescription', err);
    })
    .pipe(dest);
};

/* callback to handle Google Drive files (or an error).
 * in this callback method we just add to ctx.state
 * all files listed from google drive.
 */
const foldersHandler = (ctx, next) => (err, res, rootId) => {
    if (err) {
        console.log(err);
        return next();
    }
    const descriptionId = res.files.filter(f => f.name === 'README.md' && !f.trashed)[0].id;
    const files = res.files.filter(f => !f.trashed);
    const nextState = extend(ctx.state,
        { folders: {
            [rootId]: files
            , descriptionId
        } });
    ctx.state = nextState; //eslint-disable-line
    return next();
};

const sendReply = (ctx, next) => (fileType, file) => {
    if (fileType === 'document') {
        ctx.replyWithDocument(file);
    } else if (fileType === 'video') {
        ctx.replyWithVideo(file);
    }
    next();
};

const setDescription = (ctx, next) => path => { //eslint-disable-line
    return fs.readFile(path, 'utf8', (err, data) => {
        if (err) {
            console.log(err);
        }
        const description = data || 'No descrition setted';
        const nextState = extend(ctx.state.folders,
            {
                description
            });
        ctx.state.folders = nextState //eslint-disable-line
        next();
    });
};

/* Create a middleware for Telegraf
 * @params: fields to be listed for each file, folder id (rootId) and a authentication
 * as decribed on Google API / Drive.
 * ctx and next are the parameters from Telegraf. For more refer to Telegraf docs
 * sessoin about middleware.
 */
const createGetFolderMiddleware = params => (ctx, next) => {
    const { fields, rootId, auth } = params;
    return getFolder(rootId, fields, auth, foldersHandler(ctx, next));
};

const replyFileMiddleware = params => (ctx, next) => {
    const { fileId, fileType, path } = params;
    return getReplyFile(fileId, fileType, path, sendReply(ctx, next));
};

const setDescriptionMiddleware = params => (ctx, next) => {
    const { path, auth } = params;
    return getDescription(ctx.state.folders.descriptionId, path, auth, setDescription(ctx, next));
};

module.exports = {
    getFolder: createGetFolderMiddleware
    , replyFile: replyFileMiddleware
    , setDescription: setDescriptionMiddleware
};


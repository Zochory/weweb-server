import { Request, Response, NextFunction } from 'express'
import { db } from '../core'
import { utils, log } from '../services'

/**
 * Create design version.
 * @param req Request
 * @param res Response
 */
export const createDesignVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        log.debug('controllers:designVersion:createDesignVersion')
        if (!utils.isDefined([req.params.designId, req.body.designVersionId, req.body.cacheVersion, req.body.homePageId]))
            return res.status(400).send({ success: false, code: 'BAD_PARAMS' })

        const designVersion = await db.models.designVersion.create({
            designId: req.params.designId,
            designVersionId: req.body.designVersionId,
            cacheVersion: req.body.cacheVersion,
            domain: req.body.domain,
            homePageId: req.body.homePageId,
            langs: req.body.langs,
        })

        return res.status(200).send({ success: true, data: designVersion })
    } catch (err) /* istanbul ignore next */ {
        return next(err)
    }
}

/**
 * Set design version active.
 * @param req Request
 * @param res Response
 */
export const setCacheVersionActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
        log.debug('controllers:designVersion:setCacheVersionActive')
        if (!utils.isDefined([req.params.designId, req.params.cacheVersion])) return res.status(400).send({ success: false, code: 'BAD_PARAMS' })

        const designVersion = await db.models.designVersion.findOne({
            where: {
                designId: req.params.designId,
                cacheVersion: req.params.cacheVersion
            }
        })
        if (!designVersion) return res.status(404).send({ success: false, code: 'NOT_FOUND' })

        await db.models.designVersion.update({ isActive: false }, { where: { designId: req.params.designId, isActive: true } })

        await designVersion.update({ isActive: true })

        const designVersionsToDestroy = await db.models.designVersion.findAll({
            where: {
                designId: req.params.designId,
                isActive: false,
            },
        })
        designVersionsToDestroy.map(async designVersionToDestroy => await designVersionToDestroy.destroy())

        return res.status(200).send({ success: true })
    } catch (err) /* istanbul ignore next */ {
        return next(err)
    }
}

/**
 * Delete design versions.
 * @param req Request
 * @param res Response
 */
export const deleteDesignVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        log.debug('controllers:designVersion:deleteDesignVersions')
        if (!utils.isDefined([req.params.designId])) return res.status(400).send({ success: false, code: 'BAD_PARAMS' })

        const designVersionsToDestroy = await db.models.designVersion.findAll({
            where: {
                designId: req.params.designId,
            },
        })

        for (const designVersionToDestroy of designVersionsToDestroy) {
            await designVersionToDestroy.destroy()
        }

        return res.status(200).send({ success: true })
    } catch (err) /* istanbul ignore next */ {
        return next(err)
    }
}

/**
 * Get all routes from a design versions.
 * @param req Request
 * @param res Response
 */
export const getAllRoutes = async (req: Request, res: Response, next: NextFunction) => {
    try {
        log.debug('controllers:designVersion:getAllRoutes')
        if (!utils.isDefined([req.params.designId])) return res.status(400).send({ success: false, code: 'BAD_PARAMS' })

        const designVersion = await db.models.designVersion.findOne({
            where: {
                designId: req.params.designId,
                isActive: true,
            },
        })

        const allPages = await db.models.page.findAll({
            where: {
                designVersionId: designVersion.id,
            },
        })

        const allRoutes = []

        for (const page of allPages) {
            for (const langParams of designVersion.langs) {
                const isHomePage = designVersion.homePageId === page.pageId
                const slugLang = langParams.isDefaultPath || !langParams.default
                const lang = langParams.lang
                const path = page.paths[lang] || page.paths.default

                const route = `${slugLang ? `/${lang}` : ''}${isHomePage ? '/' : `/${path}`}`

                if (isHomePage) {
                    allRoutes.unshift(route)
                } else {
                    allRoutes.push(route)
                }
            }
        }

        //return res.status(200).send(allRoutes)

        let allRoutesHtml = '<html><body style="font-family: Arial;">'

        for (const route of allRoutes) {
            allRoutesHtml += `<h1><a href="https://${designVersion.designId}.weweb-preview.io${route}" target="_blank">${
                route || '/'
            }</a></h1><img style="width: 900px; border: 1px solid black" src="${'https://cdn-websites.weweb.io'}/designs/${designVersion.designId}/cache/${
                designVersion.designVersionId
            }/${designVersion.cacheVersion}${route.endsWith('/') ? route : `${route}/`}screen.png" /><br/><br/><br/>`
        }

        allRoutesHtml += '</body></html>'

        return res.status(200).send(allRoutesHtml)
    } catch (err) /* istanbul ignore next */ {
        return next(err)
    }
}

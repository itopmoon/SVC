const debug         = require('debug')('app:accountController');

const User          = require('../models/userModel');
const Credit        = require('../models/creditModel');
const Report        = require('../models/reportModel');



/**
 * GET /credits
 * Check credits.
 */
exports.getCredits = (req, res, next) => {
  User.findOne({ email: req.user }, (err, user) => {
    if (err) { return next(err); }
    if (!user) {
      return res.status(400).json({ msg: `Email ${req.user} not found` });
    }

    res.status(200).json(user.credits);
  });
};


/**
 * POST /credits
 * Buy vehicle check credit/s.
 */
exports.postCredits = (req, res, next) => {
  User.findOne({ email: req.user }, (err, user) => {
    if (err) { return next(err); }
    if (!user) {
      return res.status(400).json({ msg: `Email ${req.user} not found` });
    }

    const { credits } = req.body;
    if (credits && credits instanceof Array) {
      const expiry = Date.now() + (2 * 365 * 24 * 60 * 60 * 1000); // 2 years

      credits.forEach((credit) => {
        let hasReport;
        let reportId;

        if (credit.generateReport) {
          // TODO: get report from API
          const report = {
            reportType: credit.creditType,
            registration: 'ABC-1234',
            stolen: false
          }; // remove this after vehicle check API integration

          const newReport = new Report(report);
          user.reports.push(newReport);
          hasReport = true;
          reportId = newReport._id;
        }

        const newCredit = new Credit({
          creditType: credit.creditType,
          expiresAt: expiry,
          hasReport,
          reportId
        });

        user.credits.push(newCredit);
      });
    }

    user.save((err) => {
      if (err) { return next(err); }
      res.status(200).json(user.credits);
    });
  });
};


/**
 * PUT /credits
 * Use vehicle check credit/s to generate report/s.
 */
exports.putCredits = (req, res, next) => {
  req.assert('creditId', 'CreditId is not valid').isMongoId();

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).json({ msg: errors[0].msg });
  }

  User.findOne({ email: req.user }, (err, user) => {
    if (err) { return next(err); }
    if (!user) {
      return res.status(400).json({ msg: `Email ${req.user} not found` });
    }

    const updateUser = (credit) => {
      // TODO: get report from API
      const report = {
        reportType: credit.creditType,
        registration: 'ABC-5678',
        stolen: true
      }; // remove this after vehicle check API integration

      const newReport = new Report(report);
      user.reports.push(newReport);

      const index = user.credits.findIndex(c => c._id.toString() === credit._id.toString());
      debug(index);
      user.credits[index].hasReport = true;
      user.credits[index].reportId  = newReport._id;

      user.save((err) => {
        if (err) { return next(err); }

        res.json({
          creditId: credit._id,
          reportId: newReport._id
        });
      });
    };

    const { creditId } = req.body;
    if (!creditId) {
      return res.status(400).json({ msg: 'creditId is not valid' });
    }
    const credit = user.credits.find(credit => credit._id.toString() === creditId);

    if (!credit) {
      return res.status(400).json({ msg: `CreditId ${creditId} not found` });
    } else if (credit.hasReport || credit.expiresAt < Date.now()) {
      return res.status(400).json({ msg: 'Used or expired credit' });
    }
    updateUser(credit);
  });
};

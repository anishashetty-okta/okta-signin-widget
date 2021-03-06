/*jshint maxparams:14 */
define([
  'vendor/lib/q',
  'underscore',
  'jquery',
  'vendor/OktaAuth',
  'helpers/mocks/Util',
  'helpers/dom/RecoveryQuestionForm',
  'helpers/dom/Beacon',
  'helpers/util/Expect',
  'LoginRouter',
  'sandbox',
  'helpers/xhr/RECOVERY',
  'helpers/xhr/RECOVERY_ANSWER_error',
  'helpers/xhr/200',
  'helpers/xhr/SUCCESS'
],
function (Q, _, $, OktaAuth, Util, RecoveryQuestionForm, Beacon, Expect, Router,
          $sandbox, resRecovery, resError, res200, resSuccess) {

  var itp = Expect.itp;
  var tick = Expect.tick;

  function setup(settings, res) {
    var setNextResponse = Util.mockAjax();
    var baseUrl = 'https://foo.com';
    var authClient = new OktaAuth({uri: baseUrl});
    var router = new Router(_.extend({
      el: $sandbox,
      baseUrl: baseUrl,
      features: { securityImage: true },
      authClient: authClient,
      globalSuccessFn: function () {}
    }, settings));
    var form = new RecoveryQuestionForm($sandbox);
    var beacon = new Beacon($sandbox);
    Util.mockRouterNavigate(router);
    Util.mockJqueryCss();

    resRecovery.response = _.extend(resRecovery.response, res);
    setNextResponse(resRecovery);
    router.refreshAuthState('dummy-token');

    return tick().then(function () {
      return {
        router: router,
        form: form,
        beacon: beacon,
        ac: authClient,
        setNextResponse: setNextResponse
      };
    });
  }

  describe('RecoveryQuestion', function () {
    beforeEach(function () {
      $.fx.off = true;
    });
    afterEach(function () {
      $.fx.off = false;
      $sandbox.empty();
    });
    itp('displays the security beacon', function () {
      return setup().then(function (test) {
        expect(test.beacon.isSecurityBeacon()).toBe(true);
      });
    });
    itp('has a signout link which cancels the current stateToken and navigates to primaryAuth', function () {
      return setup()
      .then(function (test) {
        $.ajax.calls.reset();
        test.setNextResponse(res200);
        var $link = test.form.signoutLink();
        expect($link.length).toBe(1);
        $link.click();
        return tick(test);
      })
      .then(function (test) {
        expect($.ajax.calls.count()).toBe(1);
        Expect.isJsonPost($.ajax.calls.argsFor(0), {
          url: 'https://foo.com/api/v1/authn/cancel',
          data: {
            stateToken: 'testStateToken'
          }
        });
        expect(test.router.navigate.calls.mostRecent().args)
          .toEqual(['', { trigger: true }]);
      });
    });
    itp('sets the correct title for a forgotten password flow', function () {
      return setup().then(function (test) {
        expect(test.form.titleText()).toBe('Answer Forgotten Password Challenge');
      });
    });
    itp('sets the correct submit button value for a forgotten password flow', function () {
      return setup().then(function (test) {
        expect(test.form.submitButton().val()).toBe('Reset Password');
      });
    });
    itp('sets the correct title for an unlock account flow', function () {
      return setup({}, {recoveryType: 'UNLOCK'}).then(function (test) {
        expect(test.form.titleText()).toBe('Answer Unlock Account Challenge');
      });
    });
    itp('sets the correct submit button value for an unlock account flow', function () {
      return setup({}, {recoveryType: 'UNLOCK'}).then(function (test) {
        expect(test.form.submitButton().val()).toBe('Unlock Account');
      });
    });
    itp('sets the correct label based on the auth response', function () {
      return setup().then(function (test) {
        expect(test.form.labelText('answer')).toBe('Last 4 digits of your social security number?');
      });
    });
    itp('has a text field to enter the security question answer', function () {
      return setup().then(function (test) {
        Expect.isPasswordField(test.form.answerField());
      });
    });
    itp('has a show answer checkbox', function () {
      return setup().then(function (test) {
        var showAnswer = test.form.showAnswerCheckbox();
        expect(showAnswer.length).toBe(1);
        expect(showAnswer.attr('type')).toEqual('checkbox');
        expect(test.form.showAnswerLabelText()).toEqual('Show answer');
      });
    });
    itp('the answer field type is "password" initially and is changed to text \
          when a "show answer" checkbox is checked', function () {
      return setup().then(function (test) {
        var answer = test.form.answerField();
        expect(test.form.showAnswerCheckboxStatus()).toEqual('unchecked');
        expect(answer.attr('type')).toEqual('password');
        test.form.setShowAnswer(true);
        expect(test.form.answerField().attr('type')).toEqual('text');
        test.form.setShowAnswer(false);
        expect(test.form.answerField().attr('type')).toEqual('password');
      });
    });
    itp('makes the right auth request when form is submitted', function () {
      return setup().then(function (test) {
        $.ajax.calls.reset();
        test.form.setAnswer('4444');
        test.setNextResponse(resSuccess);
        test.form.submit();
        return tick();
      })
      .then(function () {
        expect($.ajax.calls.count()).toBe(1);
        Expect.isJsonPost($.ajax.calls.argsFor(0), {
          url: 'https://foo.com/api/v1/authn/recovery/answer',
          data: {
            answer: '4444',
            stateToken: 'testStateToken'
          }
        });
      });
    });
    itp('validates that the answer is not empty before submitting', function () {
      return setup().then(function (test) {
        $.ajax.calls.reset();
        test.form.submit();
        expect($.ajax).not.toHaveBeenCalled();
        expect(test.form.hasErrors()).toBe(true);
      });
    });
    itp('shows an error msg if there is an error submitting the answer', function () {
      return setup()
      .then(function (test) {
        Q.stopUnhandledRejectionTracking();
        test.setNextResponse(resError);
        test.form.setAnswer('4444');
        test.form.submit();
        return tick(test);
      })
      .then(function (test) {
        expect(test.form.hasErrors()).toBe(true);
        expect(test.form.errorMessage()).toBe('The recovery question answer did not match our records.');
      });
    });
  });

});

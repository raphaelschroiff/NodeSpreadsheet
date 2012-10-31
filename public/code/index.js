$(function() {
    var userName = $.cookie('userName');
    if (!userName) {
        $('#userNameInput').value(userName);
    }

    
    $('#userNameButton')
        .button()
        .click(function( event ) {
            $.cookie('userName', $('#userNameInput').value(), { expires: 7, path: '/' });
        });
});
$(function() {
    var userName = $.cookie('userName');
    if (userName) {
        $('#userNameInput').val(userName);
    }

    $('#createDocButton')
        .button()
        .click(function( event ) {
            document.location.href = 'spreadsheet/'+$('#docNameInput').val();
        });

    $('#userNameInput').change(function() {
        $.cookie('userName', $('#userNameInput').val(), { expires: 7, path: '/' });
    });
});